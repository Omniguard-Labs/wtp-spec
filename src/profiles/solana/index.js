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
  verifyEnvelope
} from './envelope.js';
import {
  buildMessageBytes,
  parseSolanaMessage,
  parseSolanaPayload,
  parseSolanaTransaction,
  signSolanaTransaction
} from './tx.js';

export * from './tx.js';
export * from './envelope.js';

export class SolanaProfileSdk {
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
    return verifyEnvelope(envelopeLike, {
      trustedRoots: options.trustedRoots || this.trustedRoots,
      now: options.now,
      requireVerified: options.requireVerified,
      expectedCluster: options.expectedCluster
    });
  }
}

export const solana = {
  profileId: 'solana-tx-v1',
  status: 'implemented',
  supported: true,
  createSignRequestEnvelope,
  createSignedTxEnvelope,
  signTransactionToEnvelope,
  encodeEnvelope,
  decodeEnvelope,
  encodeEnvelopeToQrText,
  decodeEnvelopeFromQrText,
  splitQrText,
  joinQrTextFragments,
  verifyEnvelope,
  buildMessageBytes,
  signSolanaTransaction,
  parseSolanaMessage,
  parseSolanaTransaction,
  parseSolanaPayload
};
