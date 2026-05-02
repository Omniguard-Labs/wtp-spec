import { cborDecode, cborEncode } from '../../core/cbor.js';
import { verifyQrSigningCertificate } from '../../core/certs.js';
import { createDetachedCoseSign1, verifyDetachedCoseSign1 } from '../../core/cose.js';
import { base64UrlDecode, base64UrlEncode, isoNow } from '../../core/crypto.js';
import { utils } from './ethers-utils.js';
import {
  buildSafeExecTransactionCalldata,
  decodeSafeTransaction,
  encodeSafeTransaction,
  getSafeTransactionHash,
  normalizeSafeTransaction,
  parseSafeExecTransactionCalldata,
  parseSafeSignatures
} from './safe.js';

const QR_TEXT_PREFIX = 'wtp1:';
const QR_FRAME_PREFIX = 'wtp1/';

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
  if (typeof value === 'string' && utils.isHexString(value)) {
    return utils.arrayify(value);
  }
  return value;
}

function compareBytes(left, right) {
  return utils.hexlify(left).toLowerCase() === utils.hexlify(right).toLowerCase();
}

function canonicalizeSafeTxRecord(txRecord) {
  return {
    version: Number(txRecord.version || 1),
    chain_id: maybeStringify(txRecord.chain_id),
    tx_kind: normalizeText(txRecord.tx_kind),
    tx_type: normalizeText(txRecord.tx_type || 'safe_tx'),
    safe: txRecord.safe ? utils.getAddress(String(txRecord.safe)).toLowerCase() : '',
    safe_tx_bytes: maybeBytes(txRecord.safe_tx_bytes),
    safe_tx_hash: maybeBytes(txRecord.safe_tx_hash),
    payload_hash: maybeBytes(txRecord.payload_hash),
    signatures: txRecord.tx_kind === 'safe_sign_request' ? null : maybeBytes(txRecord.signatures),
    exec_transaction_data:
      txRecord.tx_kind === 'safe_exec_transaction'
        ? maybeBytes(txRecord.exec_transaction_data)
        : null,
    issued_at: maybeStringify(txRecord.issued_at),
    expires_at: maybeStringify(txRecord.expires_at),
    wallet_app_id: maybeStringify(txRecord.wallet_app_id),
    sim_block: maybeStringify(txRecord.sim_block)
  };
}

function canonicalizeAuthRecord(authRecord) {
  return {
    auth_mode: normalizeText(authRecord.auth_mode || 'none'),
    vendor_id: normalizeText(authRecord.vendor_id),
    signing_key_id: maybeStringify(authRecord.signing_key_id),
    algorithm: maybeStringify(authRecord.algorithm),
    signature: maybeBytes(authRecord.signature),
    signing_cert: authRecord.signing_cert || null,
    root_fingerprint: maybeStringify(authRecord.root_fingerprint)
  };
}

function buildSafeTxRecord({
  safeTx,
  txKind,
  signatures = null,
  execTransactionData = null,
  issuedAt,
  expiresAt,
  walletAppId,
  simBlock
}) {
  const normalizedSafeTx = normalizeSafeTransaction(safeTx);
  const safeTxBytes = encodeSafeTransaction(normalizedSafeTx);
  const safeTxHash = getSafeTransactionHash(normalizedSafeTx);
  return canonicalizeSafeTxRecord({
    version: 1,
    chain_id: normalizedSafeTx.chain_id,
    tx_kind: txKind,
    tx_type: 'safe_tx',
    safe: normalizedSafeTx.safe,
    safe_tx_bytes: safeTxBytes,
    safe_tx_hash: utils.arrayify(safeTxHash),
    payload_hash: utils.arrayify(utils.keccak256(safeTxBytes)),
    signatures,
    exec_transaction_data: execTransactionData,
    issued_at: issuedAt || isoNow(),
    expires_at: expiresAt || '',
    wallet_app_id: walletAppId || '',
    sim_block: simBlock || ''
  });
}

function buildAuthRecord({
  txRecord,
  vendorId,
  signingCertificate,
  signingPrivateKeyPem
}) {
  if (!signingCertificate || !signingPrivateKeyPem) {
    return canonicalizeAuthRecord({
      auth_mode: 'none',
      vendor_id: vendorId || '',
      signing_key_id: '',
      algorithm: '',
      signature: null,
      signing_cert: null,
      root_fingerprint: ''
    });
  }

  return canonicalizeAuthRecord({
    auth_mode: 'vendor_sig',
    vendor_id: signingCertificate.vendor_id,
    signing_key_id: signingCertificate.key_id,
    algorithm: signingCertificate.algorithm,
    signature: createDetachedCoseSign1({
      payloadBytes: cborEncode(txRecord),
      privateKeyPem: signingPrivateKeyPem,
      keyId: signingCertificate.key_id
    }),
    signing_cert: signingCertificate,
    root_fingerprint: signingCertificate.issuer_root_fingerprint
  });
}

function normalizeEnvelopeRecord(envelope) {
  return {
    schema: normalizeText(envelope.schema || 'wtp'),
    version: Number(envelope.version || 1),
    chain_family: normalizeText(envelope.chain_family || 'evm'),
    profile: normalizeText(envelope.profile || 'evm-safe-v1'),
    tx: canonicalizeSafeTxRecord(envelope.tx || {}),
    auth: canonicalizeAuthRecord(envelope.auth || {})
  };
}

function buildEnvelope({ txRecord, vendorId, signingCertificate, signingPrivateKeyPem }) {
  return normalizeEnvelopeRecord({
    schema: 'wtp',
    version: 1,
    chain_family: 'evm',
    profile: 'evm-safe-v1',
    tx: txRecord,
    auth: buildAuthRecord({
      txRecord,
      vendorId,
      signingCertificate,
      signingPrivateKeyPem
    })
  });
}

export function createSafeSignRequestEnvelope({
  safeTx,
  vendorId,
  signingCertificate,
  signingPrivateKeyPem,
  issuedAt,
  expiresAt,
  walletAppId,
  simBlock
}) {
  const txRecord = buildSafeTxRecord({
    safeTx,
    txKind: 'safe_sign_request',
    issuedAt,
    expiresAt,
    walletAppId,
    simBlock
  });
  return buildEnvelope({ txRecord, vendorId, signingCertificate, signingPrivateKeyPem });
}

export function createSafeSignedTxEnvelope({
  safeTx,
  signatures,
  vendorId,
  signingCertificate,
  signingPrivateKeyPem,
  issuedAt,
  expiresAt,
  walletAppId,
  simBlock
}) {
  const txRecord = buildSafeTxRecord({
    safeTx,
    txKind: 'safe_signed_tx',
    signatures,
    issuedAt,
    expiresAt,
    walletAppId,
    simBlock
  });
  return buildEnvelope({ txRecord, vendorId, signingCertificate, signingPrivateKeyPem });
}

export function createSafeExecTransactionEnvelope({
  safe,
  chainId,
  nonce,
  safeTx,
  signatures,
  execTransactionData,
  vendorId,
  signingCertificate,
  signingPrivateKeyPem,
  issuedAt,
  expiresAt,
  walletAppId,
  simBlock
}) {
  const parsed =
    execTransactionData
      ? parseSafeExecTransactionCalldata(execTransactionData, { safe, chainId, nonce })
      : {
          safeTx: normalizeSafeTransaction(safeTx),
          signatures
        };
  const calldata =
    execTransactionData ||
    buildSafeExecTransactionCalldata({
      safeTx: parsed.safeTx,
      signatures: parsed.signatures
    });
  const txRecord = buildSafeTxRecord({
    safeTx: parsed.safeTx,
    txKind: 'safe_exec_transaction',
    signatures: parsed.signatures,
    execTransactionData: calldata,
    issuedAt,
    expiresAt,
    walletAppId,
    simBlock
  });
  return buildEnvelope({ txRecord, vendorId, signingCertificate, signingPrivateKeyPem });
}

export function encodeSafeEnvelope(envelope) {
  return cborEncode(normalizeEnvelopeRecord(envelope));
}

export function decodeSafeEnvelope(bytes) {
  return normalizeEnvelopeRecord(cborDecode(bytes));
}

export function encodeSafeEnvelopeToQrText(envelope) {
  return `${QR_TEXT_PREFIX}${base64UrlEncode(encodeSafeEnvelope(envelope))}`;
}

export function decodeSafeEnvelopeFromQrText(text) {
  const normalized = String(text || '').trim();
  if (!normalized.startsWith(QR_TEXT_PREFIX)) {
    throw new Error('unsupported QR text prefix');
  }
  return decodeSafeEnvelope(base64UrlDecode(normalized.slice(QR_TEXT_PREFIX.length)));
}

export function splitSafeQrText(text, { maxFragmentLength = 300 } = {}) {
  const normalized = String(text || '').trim();
  if (normalized.length <= maxFragmentLength) {
    return [normalized];
  }
  if (!normalized.startsWith(QR_TEXT_PREFIX)) {
    throw new Error('unsupported QR text prefix');
  }
  const body = normalized.slice(QR_TEXT_PREFIX.length);
  const chunkSize = Math.max(32, maxFragmentLength - 16);
  const total = Math.ceil(body.length / chunkSize);
  return Array.from({ length: total }, (_, index) => {
    const start = index * chunkSize;
    const chunk = body.slice(start, start + chunkSize);
    return `${QR_FRAME_PREFIX}${index + 1}-${total}/${chunk}`;
  });
}

export function joinSafeQrTextFragments(fragments) {
  const items = Array.isArray(fragments) ? fragments.map((item) => String(item || '').trim()) : [];
  if (!items.length) {
    throw new Error('fragments are required');
  }
  if (items.length === 1 && items[0].startsWith(QR_TEXT_PREFIX)) {
    return items[0];
  }

  const parsed = items.map((item) => {
    if (!item.startsWith(QR_FRAME_PREFIX)) {
      throw new Error('invalid QR frame prefix');
    }
    const slashIndex = item.indexOf('/', QR_FRAME_PREFIX.length);
    if (slashIndex === -1) {
      throw new Error('invalid QR frame format');
    }
    const header = item.slice(QR_FRAME_PREFIX.length, slashIndex);
    const [indexRaw, totalRaw] = header.split('-');
    return {
      index: Number(indexRaw),
      total: Number(totalRaw),
      chunk: item.slice(slashIndex + 1)
    };
  });

  const total = parsed[0].total;
  if (!parsed.every((item) => item.total === total)) {
    throw new Error('inconsistent QR frame counts');
  }
  parsed.sort((left, right) => left.index - right.index);
  for (let index = 0; index < parsed.length; index += 1) {
    if (parsed[index].index !== index + 1) {
      throw new Error('missing QR frame');
    }
  }
  return `${QR_TEXT_PREFIX}${parsed.map((item) => item.chunk).join('')}`;
}

export function verifySafeEnvelope(
  envelopeLike,
  {
    trustedRoots = [],
    now = isoNow(),
    requireVerified = false,
    expectedChainId = null,
    expectedSafe = null,
    expectedOwners = null,
    expectedThreshold = null,
    allowUnsupportedSafeSignatures = false
  } = {}
) {
  const envelope =
    typeof envelopeLike === 'string'
      ? decodeSafeEnvelopeFromQrText(envelopeLike)
      : envelopeLike instanceof Uint8Array
        ? decodeSafeEnvelope(envelopeLike)
        : normalizeEnvelopeRecord(envelopeLike);

  const txRecord = envelope.tx;
  const parsedSafeTx = decodeSafeTransaction(txRecord.safe_tx_bytes);
  const safeTxBytes = encodeSafeTransaction(parsedSafeTx);
  const safeTxHash = getSafeTransactionHash(parsedSafeTx);
  const schemaValid = envelope.schema === 'wtp';
  const versionValid = envelope.version === 1;
  const chainFamilyValid = envelope.chain_family === 'evm';
  const profileValid = envelope.profile === 'evm-safe-v1';
  const txKindValid =
    txRecord.tx_kind === 'safe_sign_request' ||
    txRecord.tx_kind === 'safe_signed_tx' ||
    txRecord.tx_kind === 'safe_exec_transaction';
  const txTypeValid = txRecord.tx_type === 'safe_tx';
  const safeTxBytesValid = compareBytes(txRecord.safe_tx_bytes, safeTxBytes);
  const safeTxHashValid = compareBytes(txRecord.safe_tx_hash, utils.arrayify(safeTxHash));
  const payloadHashValid = compareBytes(
    txRecord.payload_hash,
    utils.arrayify(utils.keccak256(safeTxBytes))
  );
  const chainIdValid = String(parsedSafeTx.chain_id) === String(txRecord.chain_id);
  const expectedChainIdValid =
    expectedChainId === null ||
    expectedChainId === undefined ||
    String(parsedSafeTx.chain_id) === String(expectedChainId);
  const safeAddressValid = parsedSafeTx.safe === txRecord.safe;
  const expectedSafeValid =
    !expectedSafe || parsedSafeTx.safe === utils.getAddress(String(expectedSafe)).toLowerCase();

  let execTransactionValid = txRecord.tx_kind !== 'safe_exec_transaction';
  if (txRecord.tx_kind === 'safe_exec_transaction') {
    try {
      const parsedExec = parseSafeExecTransactionCalldata(txRecord.exec_transaction_data, {
        safe: parsedSafeTx.safe,
        chainId: parsedSafeTx.chain_id,
        nonce: parsedSafeTx.nonce
      });
      execTransactionValid =
        compareBytes(encodeSafeTransaction(parsedExec.safeTx), safeTxBytes) &&
        compareBytes(parsedExec.signatures, txRecord.signatures);
    } catch {
      execTransactionValid = false;
    }
  }

  const signatureResult =
    txRecord.tx_kind === 'safe_sign_request'
      ? {
          count: 0,
          parsed: [],
          recoveredSigners: [],
          unsupportedCount: 0,
          layoutValid: true,
          signersSorted: true,
          ownersValid: true,
          thresholdValid: true,
          offlineVerified: true
        }
      : parseSafeSignatures(txRecord.signatures, {
          safeTxHash,
          expectedOwners,
          expectedThreshold
        });
  const signaturesValid =
    txRecord.tx_kind === 'safe_sign_request' ||
    signatureResult.offlineVerified ||
    (allowUnsupportedSafeSignatures &&
      signatureResult.layoutValid &&
      signatureResult.signersSorted &&
      signatureResult.ownersValid &&
      signatureResult.thresholdValid);

  const authRecord = envelope.auth;
  let authResult = {
    verified: false,
    trustLevel: 'none',
    reason: 'not_requested'
  };

  if (authRecord.auth_mode === 'none') {
    authResult = {
      verified: false,
      trustLevel: 'none',
      reason: 'unauthenticated',
      vendorId: authRecord.vendor_id || ''
    };
  }

  if (authRecord.auth_mode === 'vendor_sig') {
    const certResult = verifyQrSigningCertificate(authRecord.signing_cert, {
      trustedRoots,
      now
    });
    if (!certResult.verified) {
      authResult = {
        verified: false,
        trustLevel: 'declared',
        reason: certResult.reason,
        vendorId: authRecord.vendor_id || ''
      };
    } else {
      const signatureVerification = verifyDetachedCoseSign1({
        coseSign1Bytes: authRecord.signature,
        payloadBytes: cborEncode(txRecord),
        publicKey: authRecord.signing_cert.public_key
      });
      authResult = {
        verified: signatureVerification.verified,
        trustLevel: signatureVerification.verified ? 'verified' : 'declared',
        reason: signatureVerification.reason,
        vendorId: authRecord.vendor_id || '',
        rootFingerprint: authRecord.root_fingerprint,
        keyId: authRecord.signing_key_id,
        certificate: certResult.certificate,
        rootRecord: certResult.rootRecord
      };
    }
  }

  const ok =
    schemaValid &&
    versionValid &&
    chainFamilyValid &&
    profileValid &&
    txKindValid &&
    txTypeValid &&
    safeTxBytesValid &&
    safeTxHashValid &&
    payloadHashValid &&
    chainIdValid &&
    expectedChainIdValid &&
    safeAddressValid &&
    expectedSafeValid &&
    execTransactionValid &&
    signaturesValid &&
    (!requireVerified || authResult.verified);

  return {
    ok,
    envelope,
    parsedSafeTx,
    safeTxHash,
    signatures: signatureResult,
    checks: {
      schemaValid,
      versionValid,
      chainFamilyValid,
      profileValid,
      txKindValid,
      txTypeValid,
      safeTxBytesValid,
      safeTxHashValid,
      payloadHashValid,
      chainIdValid,
      expectedChainIdValid,
      safeAddressValid,
      expectedSafeValid,
      execTransactionValid,
      signaturesValid
    },
    auth: authResult
  };
}
