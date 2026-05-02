import {
  createSignRequestEnvelope,
  createSignedTxEnvelope,
  decodeEnvelope,
  decodeEnvelopeFromQrText,
  encodeEnvelope,
  encodeEnvelopeToQrText,
  joinQrTextFragments,
  signTransactionToEnvelope,
  splitQrText,
  verifyEnvelope as verifyTxEnvelope
} from './envelope.js';
import { cborDecode } from '../../core/cbor.js';
import { base64UrlDecode } from '../../core/crypto.js';
import {
  buildSafeExecTransactionCalldata,
  decodeSafeTransaction,
  encodeSafeTransaction,
  getSafeDomainSeparator,
  getSafeTransactionHash,
  getSafeTransactionStructHash,
  normalizeSafeTransaction,
  parseSafeExecTransactionCalldata,
  parseSafeSignatures,
  signSafeTransaction
} from './safe.js';
import {
  createSafeExecTransactionEnvelope,
  createSafeSignedTxEnvelope,
  createSafeSignRequestEnvelope,
  decodeSafeEnvelope,
  decodeSafeEnvelopeFromQrText,
  encodeSafeEnvelope,
  encodeSafeEnvelopeToQrText,
  joinSafeQrTextFragments,
  splitSafeQrText,
  verifySafeEnvelope
} from './safe-envelope.js';
import {
  buildUnsignedTransaction,
  describeTxType,
  parseEvmTransaction,
  recoverEip7702Authorization,
  signEip7702Authorization,
  signEvmTransaction
} from './tx.js';

export * from './tx.js';
export * from './envelope.js';
export * from './safe.js';
export * from './safe-envelope.js';

function getEnvelopeProfile(envelopeLike) {
  if (typeof envelopeLike === 'string') {
    const normalized = envelopeLike.trim();
    const body = normalized.startsWith('wtp1:') ? normalized.slice('wtp1:'.length) : normalized;
    return cborDecode(base64UrlDecode(body)).profile || '';
  }
  if (envelopeLike instanceof Uint8Array) {
    return cborDecode(envelopeLike).profile || '';
  }
  return envelopeLike?.profile || '';
}

function verifyAnyEnvelope(envelopeLike, options = {}) {
  if (getEnvelopeProfile(envelopeLike) === 'evm-safe-v1') {
    return verifySafeEnvelope(envelopeLike, options);
  }
  return verifyTxEnvelope(envelopeLike, options);
}

export class EvmProfileSdk {
  constructor({ trustedRoots = [] } = {}) {
    this.trustedRoots = trustedRoots;
  }

  createSignRequestEnvelope(args) {
    return createSignRequestEnvelope(args);
  }

  createSignedTxEnvelope(args) {
    return createSignedTxEnvelope(args);
  }

  signTransactionToEnvelope(args) {
    return signTransactionToEnvelope(args);
  }

  verifyEnvelope(envelopeLike, options = {}) {
    return verifyAnyEnvelope(envelopeLike, {
      trustedRoots: options.trustedRoots || this.trustedRoots,
      now: options.now,
      requireVerified: options.requireVerified,
      expectedChainId: options.expectedChainId,
      expectedSafe: options.expectedSafe,
      expectedOwners: options.expectedOwners,
      expectedThreshold: options.expectedThreshold,
      allowUnsupportedSafeSignatures: options.allowUnsupportedSafeSignatures
    });
  }

  verifySafeEnvelope(envelopeLike, options = {}) {
    return verifySafeEnvelope(envelopeLike, {
      trustedRoots: options.trustedRoots || this.trustedRoots,
      now: options.now,
      requireVerified: options.requireVerified,
      expectedChainId: options.expectedChainId,
      expectedSafe: options.expectedSafe,
      expectedOwners: options.expectedOwners,
      expectedThreshold: options.expectedThreshold,
      allowUnsupportedSafeSignatures: options.allowUnsupportedSafeSignatures
    });
  }
}

export const evm = {
  profileId: 'evm-tx-v1',
  safeProfileId: 'evm-safe-v1',
  createSignRequestEnvelope,
  createSignedTxEnvelope,
  signTransactionToEnvelope,
  encodeEnvelope,
  decodeEnvelope,
  encodeEnvelopeToQrText,
  decodeEnvelopeFromQrText,
  splitQrText,
  joinQrTextFragments,
  verifyEnvelope: verifyAnyEnvelope,
  verifyTxEnvelope,
  createSafeSignRequestEnvelope,
  createSafeSignedTxEnvelope,
  createSafeExecTransactionEnvelope,
  encodeSafeEnvelope,
  decodeSafeEnvelope,
  encodeSafeEnvelopeToQrText,
  decodeSafeEnvelopeFromQrText,
  splitSafeQrText,
  joinSafeQrTextFragments,
  verifySafeEnvelope,
  buildUnsignedTransaction,
  signEvmTransaction,
  signEip7702Authorization,
  recoverEip7702Authorization,
  parseEvmTransaction,
  describeTxType,
  normalizeSafeTransaction,
  encodeSafeTransaction,
  decodeSafeTransaction,
  getSafeDomainSeparator,
  getSafeTransactionStructHash,
  getSafeTransactionHash,
  signSafeTransaction,
  parseSafeSignatures,
  buildSafeExecTransactionCalldata,
  parseSafeExecTransactionCalldata
};
