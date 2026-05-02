export type BytesLike = Uint8Array | string;

export interface VendorRootRecord {
  version: number;
  record_type: 'vendor_root' | string;
  vendor_id: string;
  display_name: string;
  algorithm: 'Ed25519' | string;
  public_key: Uint8Array;
  root_fingerprint: string;
  valid_from: string;
  valid_to: string;
  status: 'active' | string;
}

export interface QrSigningCertificate {
  version: number;
  cert_type: 'qr_signing' | string;
  vendor_id: string;
  key_id: string;
  algorithm: 'Ed25519' | string;
  public_key: Uint8Array;
  issuer_root_fingerprint: string;
  valid_from: string;
  valid_to: string;
  status: 'active' | string;
  issuer_signature: Uint8Array;
}

export interface RevocationRecord {
  type: 'signing_key' | 'qr_signing_cert' | 'certificate' | 'vendor_root' | 'root' | string;
  key_id?: string;
  root_fingerprint?: string;
  revoked_at?: string;
  reason?: string;
}

export interface TrustMetadata {
  schema: 'wtp-trust' | string;
  version: number;
  vendor_id: string;
  display_name: string;
  issued_at: string;
  expires_at: string;
  roots: VendorRootRecord[];
  qr_signing_certs: QrSigningCertificate[];
  revocations: RevocationRecord[];
  mirrors: Array<{
    role: string;
    url: string;
    media_type: string;
  }>;
  auth: {
    auth_mode: 'none' | 'root_sig' | string;
    root_fingerprint?: string;
    signing_key_id?: string;
    algorithm?: string;
    signature?: Uint8Array | null;
  };
}

export interface VerificationResult {
  ok: boolean;
  checks: Record<string, boolean>;
  auth: Record<string, unknown>;
}

export interface WellKnownUrls {
  suffix: string;
  metadataCborUrl: string;
  metadataJsonUrl: string;
}

export interface SafeTransaction {
  version: number;
  safe: string;
  chain_id: string;
  to: string;
  value: string;
  data: string;
  operation: 0 | 1 | number;
  safe_tx_gas: string;
  base_gas: string;
  gas_price: string;
  gas_token: string;
  refund_receiver: string;
  nonce: string;
}

export interface SafeSignatureSummary {
  signatures: string;
  count: number;
  parsed: Array<Record<string, unknown>>;
  recoveredSigners: string[];
  unsupportedCount: number;
  layoutValid: boolean;
  signersSorted: boolean;
  ownersValid: boolean;
  thresholdValid: boolean;
  offlineVerified: boolean;
}

export interface SafeSigningResult {
  safeTxHash: string;
  signatures: string;
  signers: string[];
  signatureType: string;
}

export interface EnvelopeAuthRecord {
  auth_mode: 'none' | 'vendor_sig' | string;
  vendor_id: string;
  signing_key_id: string;
  algorithm: string;
  signature: Uint8Array | null;
  signing_cert: QrSigningCertificate | null;
  root_fingerprint: string;
}

export interface SafeEnvelopeTxRecord {
  version: number;
  chain_id: string;
  tx_kind: 'safe_sign_request' | 'safe_signed_tx' | 'safe_exec_transaction' | string;
  tx_type: 'safe_tx' | string;
  safe: string;
  safe_tx_bytes: Uint8Array;
  safe_tx_hash: Uint8Array;
  payload_hash: Uint8Array;
  signatures: Uint8Array | null;
  exec_transaction_data: Uint8Array | null;
  issued_at: string;
  expires_at: string;
  wallet_app_id: string;
  sim_block: string;
}

export interface SafeEnvelope {
  schema: 'wtp' | string;
  version: number;
  chain_family: 'evm' | string;
  profile: 'evm-safe-v1' | string;
  tx: SafeEnvelopeTxRecord;
  auth: EnvelopeAuthRecord;
}

export interface SafeEnvelopeVerificationResult extends VerificationResult {
  envelope: SafeEnvelope;
  parsedSafeTx: SafeTransaction;
  safeTxHash: string;
  signatures: SafeSignatureSummary;
}

export interface GeneratedVendorRoot {
  publicKeyPem: string;
  publicKeyDer: Uint8Array;
  privateKeyPem: string;
  rootRecord: VendorRootRecord;
}

export interface GeneratedQrSigningIdentity {
  publicKeyPem: string;
  publicKeyDer: Uint8Array;
  privateKeyPem: string;
  certificate: QrSigningCertificate;
}

export declare class WtpSdk {
  constructor(options?: { trustedRoots?: VendorRootRecord[] });
  trustedRoots: VendorRootRecord[];
  evm: Record<string, unknown>;
  solana: Record<string, unknown>;
  verifyTrustMetadata(metadataLike: TrustMetadata | Uint8Array, options?: {
    trustedRoots?: VendorRootRecord[];
    now?: string;
    requireSigned?: boolean;
  }): VerificationResult;
}

export declare function generateVendorRoot(options: {
  vendorId: string;
  displayName: string;
  validFrom?: string;
  validTo?: string;
  status?: string;
  algorithm?: string;
}): GeneratedVendorRoot;

export declare function generateQrSigningIdentity(options: {
  vendorId: string;
  keyId: string;
  rootRecord: VendorRootRecord;
  rootPrivateKeyPem: string;
  validFrom?: string;
  validTo?: string;
  status?: string;
  algorithm?: string;
}): GeneratedQrSigningIdentity;

export declare function createTrustMetadata(options: {
  vendorId: string;
  displayName: string;
  roots?: VendorRootRecord[];
  qrSigningCerts?: QrSigningCertificate[];
  revocations?: RevocationRecord[];
  mirrors?: TrustMetadata['mirrors'];
  signerRootRecord?: VendorRootRecord;
  signerPrivateKeyPem?: string;
  issuedAt?: string;
  expiresAt?: string;
}): TrustMetadata;

export declare function encodeTrustMetadata(metadata: TrustMetadata): Uint8Array;
export declare function decodeTrustMetadata(bytes: Uint8Array): TrustMetadata;
export declare function trustMetadataToDiagnosticJson(metadata: TrustMetadata): unknown;
export declare function verifyTrustMetadata(metadataLike: TrustMetadata | Uint8Array, options?: {
  trustedRoots?: VendorRootRecord[];
  now?: string;
  requireSigned?: boolean;
}): VerificationResult;
export declare function buildWellKnownWtpUrls(origin: string): WellKnownUrls;

export declare function normalizeSafeTransaction(txLike: Record<string, unknown>): SafeTransaction;
export declare function encodeSafeTransaction(safeTxLike: Record<string, unknown>): Uint8Array;
export declare function decodeSafeTransaction(bytes: Uint8Array): SafeTransaction;
export declare function getSafeDomainSeparator(safeTxLike: Record<string, unknown>): string;
export declare function getSafeTransactionStructHash(safeTxLike: Record<string, unknown>): string;
export declare function getSafeTransactionHash(safeTxLike: Record<string, unknown>): string;
export declare function signSafeTransaction(options: {
  safeTx: Record<string, unknown>;
  privateKey?: string;
  privateKeys?: string[];
  signatureType?: 'eip712' | 'eth_sign' | string;
}): SafeSigningResult;
export declare function parseSafeSignatures(signaturesLike: BytesLike, options?: {
  safeTxHash: string;
  expectedOwners?: string[];
  expectedThreshold?: number;
}): SafeSignatureSummary;
export declare function buildSafeExecTransactionCalldata(options: {
  safeTx: Record<string, unknown>;
  signatures: BytesLike;
}): string;
export declare function parseSafeExecTransactionCalldata(calldata: BytesLike, options: {
  safe: string;
  chainId: string | number | bigint;
  nonce: string | number | bigint;
}): { safeTx: SafeTransaction; signatures: string };
export declare function createSafeSignRequestEnvelope(options: {
  safeTx: Record<string, unknown>;
  vendorId?: string;
  signingCertificate?: QrSigningCertificate;
  signingPrivateKeyPem?: string;
  issuedAt?: string;
  expiresAt?: string;
  walletAppId?: string;
  simBlock?: string;
}): SafeEnvelope;
export declare function createSafeSignedTxEnvelope(options: {
  safeTx: Record<string, unknown>;
  signatures: BytesLike;
  vendorId?: string;
  signingCertificate?: QrSigningCertificate;
  signingPrivateKeyPem?: string;
  issuedAt?: string;
  expiresAt?: string;
  walletAppId?: string;
  simBlock?: string;
}): SafeEnvelope;
export declare function createSafeExecTransactionEnvelope(options: {
  safe?: string;
  chainId?: string | number | bigint;
  nonce?: string | number | bigint;
  safeTx?: Record<string, unknown>;
  signatures?: BytesLike;
  execTransactionData?: BytesLike;
  vendorId?: string;
  signingCertificate?: QrSigningCertificate;
  signingPrivateKeyPem?: string;
  issuedAt?: string;
  expiresAt?: string;
  walletAppId?: string;
  simBlock?: string;
}): SafeEnvelope;
export declare function encodeSafeEnvelope(envelope: SafeEnvelope): Uint8Array;
export declare function decodeSafeEnvelope(bytes: Uint8Array): SafeEnvelope;
export declare function encodeSafeEnvelopeToQrText(envelope: SafeEnvelope): string;
export declare function decodeSafeEnvelopeFromQrText(text: string): SafeEnvelope;
export declare function splitSafeQrText(text: string, options?: {
  maxFragmentLength?: number;
}): string[];
export declare function joinSafeQrTextFragments(fragments: string[]): string;
export declare function verifySafeEnvelope(envelopeLike: SafeEnvelope | Uint8Array | string, options?: {
  trustedRoots?: VendorRootRecord[];
  now?: string;
  requireVerified?: boolean;
  expectedChainId?: string | number | bigint;
  expectedSafe?: string;
  expectedOwners?: string[];
  expectedThreshold?: number;
  allowUnsupportedSafeSignatures?: boolean;
}): SafeEnvelopeVerificationResult;

export declare const evm: Record<string, unknown>;
export declare const solana: Record<string, unknown>;
