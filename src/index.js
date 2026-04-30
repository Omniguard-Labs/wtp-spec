import {
  buildVendorRootRecord,
  generateQrSigningIdentity,
  generateVendorRoot,
  issueQrSigningCertificate,
  verifyQrSigningCertificate
} from './core/certs.js';
import {
  base64UrlDecode,
  base64UrlEncode,
  fingerprintPublicKey,
  generateEd25519KeyPair,
  publicKeyDerToPem,
  publicKeyPemToDer
} from './core/crypto.js';
import {
  buildWellKnownWtvUrls,
  buildWellKnownWtpUrls,
  createTrustMetadata,
  decodeTrustMetadata,
  encodeTrustMetadata,
  trustMetadataToDiagnosticJson,
  verifyTrustMetadata
} from './core/trust.js';
import { EvmProfileSdk, evm } from './profiles/evm/index.js';
import { SolanaProfileSdk, solana } from './profiles/solana/index.js';

export * from './core/index.js';
export * from './profiles/evm/index.js';
export { SolanaProfileSdk, solana } from './profiles/solana/index.js';

export class WtpSdk {
  constructor({ trustedRoots = [] } = {}) {
    this.trustedRoots = trustedRoots;
    this.evm = new EvmProfileSdk({ trustedRoots });
    this.solana = new SolanaProfileSdk({ trustedRoots });
  }

  static generateVendorRoot = generateVendorRoot;
  static buildVendorRootRecord = buildVendorRootRecord;
  static generateQrSigningIdentity = generateQrSigningIdentity;
  static issueQrSigningCertificate = issueQrSigningCertificate;
  static verifyQrSigningCertificate = verifyQrSigningCertificate;
  static generateEd25519KeyPair = generateEd25519KeyPair;
  static fingerprintPublicKey = fingerprintPublicKey;
  static publicKeyPemToDer = publicKeyPemToDer;
  static publicKeyDerToPem = publicKeyDerToPem;
  static base64UrlEncode = base64UrlEncode;
  static base64UrlDecode = base64UrlDecode;
  static createTrustMetadata = createTrustMetadata;
  static encodeTrustMetadata = encodeTrustMetadata;
  static decodeTrustMetadata = decodeTrustMetadata;
  static verifyTrustMetadata = verifyTrustMetadata;
  static trustMetadataToDiagnosticJson = trustMetadataToDiagnosticJson;
  static buildWellKnownWtpUrls = buildWellKnownWtpUrls;
  static buildWellKnownWtvUrls = buildWellKnownWtvUrls;
  static evm = evm;
  static solana = solana;

  verifyTrustMetadata(metadataLike, options = {}) {
    return verifyTrustMetadata(metadataLike, {
      trustedRoots: options.trustedRoots || this.trustedRoots,
      now: options.now,
      requireSigned: options.requireSigned
    });
  }
}

export class WtvSdk extends WtpSdk {}
