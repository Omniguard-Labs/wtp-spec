import { Buffer } from 'node:buffer';

import { PublicKey } from '@solana/web3.js';

import { cborDecode, cborEncode } from '../../core/cbor.js';
import { verifyQrSigningCertificate } from '../../core/certs.js';
import { createDetachedCoseSign1, verifyDetachedCoseSign1 } from '../../core/cose.js';
import { base64UrlDecode, base64UrlEncode, isoNow } from '../../core/crypto.js';
import {
  buildMessageBytes,
  parseSolanaMessage,
  parseSolanaTransaction,
  signSolanaTransaction
} from './tx.js';

const QR_TEXT_PREFIX = 'wtv1:';
const QR_FRAME_PREFIX = 'wtv1/';

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
  if (Buffer.isBuffer(value)) {
    return new Uint8Array(value);
  }
  if (typeof value === 'string') {
    if (value.startsWith('0x')) {
      return new Uint8Array(Buffer.from(value.slice(2), 'hex'));
    }
    return new Uint8Array(Buffer.from(value, 'base64'));
  }
  return value;
}

function normalizePublicKey(value) {
  if (!value) {
    return '';
  }
  return new PublicKey(value).toBase58();
}

function compareBytes(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right)) === 0;
}

function getTxBytes(txRecord) {
  if (txRecord.tx_kind === 'sign_request') {
    return txRecord.message_bytes;
  }
  if (txRecord.tx_kind === 'signed_tx') {
    return txRecord.serialized_tx_bytes;
  }
  throw new Error(`unsupported tx kind: ${txRecord.tx_kind}`);
}

function canonicalizeTxRecord(txRecord) {
  return {
    version: Number(txRecord.version || 1),
    cluster: normalizeText(txRecord.cluster),
    tx_kind: normalizeText(txRecord.tx_kind),
    tx_format: normalizeText(txRecord.tx_format),
    message_bytes: txRecord.tx_kind === 'sign_request' ? maybeBytes(txRecord.message_bytes) : null,
    serialized_tx_bytes:
      txRecord.tx_kind === 'signed_tx' ? maybeBytes(txRecord.serialized_tx_bytes) : null,
    payload_hash: maybeBytes(txRecord.payload_hash),
    fee_payer: normalizePublicKey(txRecord.fee_payer),
    recent_blockhash: maybeStringify(txRecord.recent_blockhash),
    required_signatures: Number(txRecord.required_signatures || 0),
    signer_pubkeys: Array.isArray(txRecord.signer_pubkeys)
      ? txRecord.signer_pubkeys.map((value) => normalizePublicKey(value))
      : [],
    issued_at: maybeStringify(txRecord.issued_at),
    expires_at: maybeStringify(txRecord.expires_at),
    wallet_app_id: maybeStringify(txRecord.wallet_app_id),
    last_valid_block_height: maybeStringify(txRecord.last_valid_block_height),
    sim_slot: maybeStringify(txRecord.sim_slot)
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
  return canonicalizeTxRecord({
    version: 1,
    cluster: meta.cluster || parsedTx.cluster || '',
    tx_kind: parsedTx.kind,
    tx_format: parsedTx.txFormat,
    message_bytes: parsedTx.kind === 'sign_request' ? parsedTx.messageBytes : null,
    serialized_tx_bytes: parsedTx.kind === 'signed_tx' ? parsedTx.serializedTxBytes : null,
    payload_hash: parsedTx.payloadHash,
    fee_payer: parsedTx.feePayer,
    recent_blockhash: parsedTx.recentBlockhash,
    required_signatures: parsedTx.requiredSignatures,
    signer_pubkeys: parsedTx.signerPubkeys,
    issued_at: meta.issuedAt || isoNow(),
    expires_at: meta.expiresAt || '',
    wallet_app_id: meta.walletAppId || '',
    last_valid_block_height: meta.lastValidBlockHeight ?? parsedTx.lastValidBlockHeight ?? '',
    sim_slot: meta.simSlot ?? parsedTx.simSlot ?? ''
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
    schema: normalizeText(envelope.schema || 'wtv'),
    version: Number(envelope.version || 1),
    chain_family: normalizeText(envelope.chain_family || 'solana'),
    profile: normalizeText(envelope.profile || 'solana-tx-v1'),
    tx: canonicalizeTxRecord(envelope.tx || {}),
    auth: canonicalizeAuthRecord(envelope.auth || {})
  };
}

export function createSignRequestEnvelope({
  txLike,
  messageBytes,
  vendorId,
  signingCertificate,
  signingPrivateKeyPem,
  cluster,
  issuedAt,
  expiresAt,
  walletAppId,
  lastValidBlockHeight,
  simSlot
}) {
  const parsedTx = parseSolanaMessage(messageBytes || buildMessageBytes(txLike), {
    cluster,
    lastValidBlockHeight,
    simSlot
  });
  const txRecord = buildTxRecordFromParsed(parsedTx, {
    cluster,
    issuedAt,
    expiresAt,
    walletAppId,
    lastValidBlockHeight,
    simSlot
  });
  return normalizeEnvelopeRecord({
    schema: 'wtv',
    version: 1,
    chain_family: 'solana',
    profile: 'solana-tx-v1',
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
  cluster,
  issuedAt,
  expiresAt,
  walletAppId,
  lastValidBlockHeight,
  simSlot
}) {
  const parsedTx = parseSolanaTransaction(signedTx, {
    cluster,
    lastValidBlockHeight,
    simSlot
  });
  const txRecord = buildTxRecordFromParsed(parsedTx, {
    cluster,
    issuedAt,
    expiresAt,
    walletAppId,
    lastValidBlockHeight,
    simSlot
  });
  return normalizeEnvelopeRecord({
    schema: 'wtv',
    version: 1,
    chain_family: 'solana',
    profile: 'solana-tx-v1',
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
  signers,
  vendorId,
  signingCertificate,
  signingPrivateKeyPem,
  cluster,
  issuedAt,
  expiresAt,
  walletAppId,
  lastValidBlockHeight,
  simSlot
}) {
  const parsedTx = signSolanaTransaction({
    txLike,
    signers
  });
  return createSignedTxEnvelope({
    signedTx: parsedTx.serializedTxBytes,
    vendorId,
    signingCertificate,
    signingPrivateKeyPem,
    cluster,
    issuedAt,
    expiresAt,
    walletAppId,
    lastValidBlockHeight,
    simSlot
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

export function verifyEnvelope(
  envelopeLike,
  { trustedRoots = [], now = isoNow(), requireVerified = false, expectedCluster = '' } = {}
) {
  const envelope =
    typeof envelopeLike === 'string'
      ? decodeEnvelopeFromQrText(envelopeLike)
      : envelopeLike instanceof Uint8Array
        ? decodeEnvelope(envelopeLike)
        : normalizeEnvelopeRecord(envelopeLike);

  const txRecord = envelope.tx;
  const txPayloadBytes = getTxBytes(txRecord);
  const parsedTx =
    txRecord.tx_kind === 'sign_request'
      ? parseSolanaMessage(txPayloadBytes, {
          cluster: txRecord.cluster,
          lastValidBlockHeight: txRecord.last_valid_block_height,
          simSlot: txRecord.sim_slot
        })
      : parseSolanaTransaction(txPayloadBytes, {
          cluster: txRecord.cluster,
          lastValidBlockHeight: txRecord.last_valid_block_height,
          simSlot: txRecord.sim_slot
        });

  const schemaValid = envelope.schema === 'wtv';
  const versionValid = envelope.version === 1;
  const chainFamilyValid = envelope.chain_family === 'solana';
  const profileValid = envelope.profile === 'solana-tx-v1';
  const expectedClusterValid =
    !expectedCluster || txRecord.cluster === normalizeText(expectedCluster);
  const payloadHashValid = compareBytes(txRecord.payload_hash, parsedTx.payloadHash);
  const txKindValid = txRecord.tx_kind === parsedTx.kind;
  const txFormatValid = txRecord.tx_format === parsedTx.txFormat;
  const feePayerValid = txRecord.fee_payer === parsedTx.feePayer;
  const recentBlockhashValid = txRecord.recent_blockhash === parsedTx.recentBlockhash;
  const requiredSignaturesValid =
    Number(txRecord.required_signatures) === parsedTx.requiredSignatures;
  const signerPubkeysValid =
    txRecord.signer_pubkeys.length === parsedTx.signerPubkeys.length &&
    txRecord.signer_pubkeys.every((value, index) => value === parsedTx.signerPubkeys[index]);
  const packetSizeValid = parsedTx.packetSizeValid;
  const signatureCountValid =
    parsedTx.kind !== 'signed_tx' || parsedTx.signatureCountValid === true;
  const transactionSignaturesValid =
    parsedTx.kind !== 'signed_tx' || parsedTx.signaturesValid === true;

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
    expectedClusterValid &&
    payloadHashValid &&
    txKindValid &&
    txFormatValid &&
    feePayerValid &&
    recentBlockhashValid &&
    requiredSignaturesValid &&
    signerPubkeysValid &&
    packetSizeValid &&
    signatureCountValid &&
    transactionSignaturesValid &&
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
      expectedClusterValid,
      payloadHashValid,
      txKindValid,
      txFormatValid,
      feePayerValid,
      recentBlockhashValid,
      requiredSignaturesValid,
      signerPubkeysValid,
      packetSizeValid,
      signatureCountValid,
      transactionSignaturesValid
    },
    auth: authResult
  };
}
