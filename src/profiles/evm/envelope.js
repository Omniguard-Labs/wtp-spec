import { cborDecode, cborEncode } from '../../core/cbor.js';
import { verifyQrSigningCertificate } from '../../core/certs.js';
import { createDetachedCoseSign1, verifyDetachedCoseSign1 } from '../../core/cose.js';
import { base64UrlDecode, base64UrlEncode, isoNow } from '../../core/crypto.js';
import { utils } from './ethers-utils.js';
import { buildUnsignedTransaction, parseEvmTransaction, signEvmTransaction } from './tx.js';

const QR_TEXT_PREFIX = 'wtv1:';
const QR_FRAME_PREFIX = 'wtv1/';

function normalizeAddressForEnvelope(value) {
  return value ? utils.getAddress(String(value)).toLowerCase() : '';
}

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

function getTxBytes(txRecord) {
  if (txRecord.tx_kind === 'sign_request') {
    return txRecord.unsigned_tx_bytes;
  }
  if (txRecord.tx_kind === 'signed_tx') {
    return txRecord.signed_tx_bytes;
  }
  throw new Error(`unsupported tx kind: ${txRecord.tx_kind}`);
}

function canonicalizeTxRecord(txRecord) {
  return {
    version: Number(txRecord.version || 1),
    chain_id: maybeStringify(txRecord.chain_id),
    tx_kind: normalizeText(txRecord.tx_kind),
    tx_type: normalizeText(txRecord.tx_type),
    unsigned_tx_bytes: txRecord.tx_kind === 'sign_request' ? maybeBytes(txRecord.unsigned_tx_bytes) : null,
    signed_tx_bytes: txRecord.tx_kind === 'signed_tx' ? maybeBytes(txRecord.signed_tx_bytes) : null,
    payload_hash: maybeBytes(txRecord.payload_hash),
    from: normalizeAddressForEnvelope(txRecord.from),
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

function buildTxRecordFromParsed(parsedTx, meta = {}) {
  const txBytes =
    parsedTx.kind === 'sign_request'
      ? utils.arrayify(parsedTx.unsignedTxHex)
      : utils.arrayify(parsedTx.serializedTxHex);

  return canonicalizeTxRecord({
    version: 1,
    chain_id: String(parsedTx.chainId),
    tx_kind: parsedTx.kind,
    tx_type: parsedTx.txTypeName,
    unsigned_tx_bytes: parsedTx.kind === 'sign_request' ? txBytes : null,
    signed_tx_bytes: parsedTx.kind === 'signed_tx' ? txBytes : null,
    payload_hash: utils.arrayify(parsedTx.payloadHash),
    from: parsedTx.kind === 'signed_tx' ? parsedTx.from : meta.from,
    issued_at: meta.issuedAt || isoNow(),
    expires_at: meta.expiresAt || '',
    wallet_app_id: meta.walletAppId || '',
    sim_block: meta.simBlock || ''
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

  const txBytes = cborEncode(txRecord);
  return canonicalizeAuthRecord({
    auth_mode: 'vendor_sig',
    vendor_id: signingCertificate.vendor_id,
    signing_key_id: signingCertificate.key_id,
    algorithm: signingCertificate.algorithm,
    signature: createDetachedCoseSign1({
      payloadBytes: txBytes,
      privateKeyPem: signingPrivateKeyPem,
      keyId: signingCertificate.key_id
    }),
    signing_cert: signingCertificate,
    root_fingerprint: signingCertificate.issuer_root_fingerprint
  });
}

function normalizeEnvelopeRecord(envelope) {
  return {
    schema: normalizeText(envelope.schema || 'wtv'),
    version: Number(envelope.version || 1),
    chain_family: normalizeText(envelope.chain_family || 'evm'),
    profile: normalizeText(envelope.profile || 'evm-tx-v1'),
    tx: canonicalizeTxRecord(envelope.tx || {}),
    auth: canonicalizeAuthRecord(envelope.auth || {})
  };
}

export function createSignRequestEnvelope({
  txLike,
  unsignedTx,
  from,
  vendorId,
  signingCertificate,
  signingPrivateKeyPem,
  issuedAt,
  expiresAt,
  walletAppId,
  simBlock
}) {
  const parsedTx = parseEvmTransaction(unsignedTx || buildUnsignedTransaction(txLike));
  if (parsedTx.kind !== 'sign_request') {
    throw new Error('expected unsigned transaction bytes');
  }
  const txRecord = buildTxRecordFromParsed(parsedTx, {
    from,
    issuedAt,
    expiresAt,
    walletAppId,
    simBlock
  });
  return normalizeEnvelopeRecord({
    schema: 'wtv',
    version: 1,
    chain_family: 'evm',
    profile: 'evm-tx-v1',
    tx: txRecord,
    auth: buildAuthRecord({
      txRecord,
      vendorId,
      signingCertificate,
      signingPrivateKeyPem
    })
  });
}

export function createSignedTxEnvelope({
  signedTx,
  vendorId,
  signingCertificate,
  signingPrivateKeyPem,
  issuedAt,
  expiresAt,
  walletAppId,
  simBlock
}) {
  const parsedTx = parseEvmTransaction(signedTx);
  if (parsedTx.kind !== 'signed_tx') {
    throw new Error('expected signed transaction bytes');
  }
  const txRecord = buildTxRecordFromParsed(parsedTx, {
    issuedAt,
    expiresAt,
    walletAppId,
    simBlock
  });
  return normalizeEnvelopeRecord({
    schema: 'wtv',
    version: 1,
    chain_family: 'evm',
    profile: 'evm-tx-v1',
    tx: txRecord,
    auth: buildAuthRecord({
      txRecord,
      vendorId,
      signingCertificate,
      signingPrivateKeyPem
    })
  });
}

export function signTransactionToEnvelope({
  txLike,
  txPrivateKey,
  vendorId,
  signingCertificate,
  signingPrivateKeyPem,
  issuedAt,
  expiresAt,
  walletAppId,
  simBlock
}) {
  const parsedTx = signEvmTransaction(txLike, txPrivateKey);
  return createSignedTxEnvelope({
    signedTx: parsedTx.serializedTxHex,
    vendorId,
    signingCertificate,
    signingPrivateKeyPem,
    issuedAt,
    expiresAt,
    walletAppId,
    simBlock
  });
}

export function encodeEnvelope(envelope) {
  return cborEncode(normalizeEnvelopeRecord(envelope));
}

export function decodeEnvelope(bytes) {
  return normalizeEnvelopeRecord(cborDecode(bytes));
}

export function encodeEnvelopeToQrText(envelope) {
  return `${QR_TEXT_PREFIX}${base64UrlEncode(encodeEnvelope(envelope))}`;
}

export function decodeEnvelopeFromQrText(text) {
  const normalized = String(text || '').trim();
  if (!normalized.startsWith(QR_TEXT_PREFIX)) {
    throw new Error('unsupported QR text prefix');
  }
  return decodeEnvelope(base64UrlDecode(normalized.slice(QR_TEXT_PREFIX.length)));
}

export function splitQrText(text, { maxFragmentLength = 300 } = {}) {
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

export function joinQrTextFragments(fragments) {
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

function compareHexBytes(left, right) {
  const leftHex = utils.hexlify(left).toLowerCase();
  const rightHex = utils.hexlify(right).toLowerCase();
  return leftHex === rightHex;
}

export function verifyEnvelope(
  envelopeLike,
  { trustedRoots = [], now = isoNow(), requireVerified = false, expectedChainId = null } = {}
) {
  const envelope =
    typeof envelopeLike === 'string'
      ? decodeEnvelopeFromQrText(envelopeLike)
      : envelopeLike instanceof Uint8Array
        ? decodeEnvelope(envelopeLike)
        : normalizeEnvelopeRecord(envelopeLike);

  const txRecord = envelope.tx;
  const txPayloadBytes = getTxBytes(txRecord);
  const parsedTx = parseEvmTransaction(txPayloadBytes);
  const schemaValid = envelope.schema === 'wtv';
  const versionValid = envelope.version === 1;
  const chainFamilyValid = envelope.chain_family === 'evm';
  const profileValid = envelope.profile === 'evm-tx-v1';
  const payloadHashValid = compareHexBytes(
    txRecord.payload_hash,
    utils.arrayify(parsedTx.payloadHash)
  );
  const chainIdValid = String(parsedTx.chainId) === String(txRecord.chain_id);
  const expectedChainIdValid =
    expectedChainId === null ||
    expectedChainId === undefined ||
    String(parsedTx.chainId) === String(expectedChainId);
  const txTypeValid = parsedTx.txTypeName === txRecord.tx_type;
  const fromValid =
    txRecord.tx_kind !== 'sign_request' ||
    !txRecord.from ||
    parsedTx.kind === 'sign_request';

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
      const signatureResult = verifyDetachedCoseSign1({
        coseSign1Bytes: authRecord.signature,
        payloadBytes: cborEncode(txRecord),
        publicKey: authRecord.signing_cert.public_key
      });
      authResult = {
        verified: signatureResult.verified,
        trustLevel: signatureResult.verified ? 'verified' : 'declared',
        reason: signatureResult.reason,
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
    payloadHashValid &&
    chainIdValid &&
    expectedChainIdValid &&
    txTypeValid &&
    fromValid &&
    (!requireVerified || authResult.verified);

  return {
    ok,
    envelope,
    parsedTx,
    checks: {
      schemaValid,
      versionValid,
      chainFamilyValid,
      profileValid,
      payloadHashValid,
      chainIdValid,
      expectedChainIdValid,
      txTypeValid,
      fromValid
    },
    auth: authResult
  };
}
