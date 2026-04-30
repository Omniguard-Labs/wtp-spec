import { Buffer } from 'node:buffer';

import {
  AddressLookupTableAccount,
  Keypair,
  PACKET_DATA_SIZE,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedMessage,
  VersionedTransaction
} from '@solana/web3.js';

import { base64UrlEncode, sha256, verifyEd25519 } from '../../core/crypto.js';

const ED25519_SPKI_PREFIX = Uint8Array.from([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00
]);

function isPresent(value) {
  return value !== undefined && value !== null && value !== '';
}

function ensureBytes(value, fieldName = 'value') {
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
  throw new TypeError(`${fieldName} must be Uint8Array, Buffer, hex, or base64`);
}

function ensurePublicKey(value, fieldName = 'public key') {
  if (value instanceof PublicKey) {
    return value;
  }
  if (typeof value === 'string' || value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return new PublicKey(value);
  }
  throw new TypeError(`invalid ${fieldName}`);
}

function ensureInstruction(value) {
  if (value instanceof TransactionInstruction) {
    return value;
  }
  return new TransactionInstruction({
    programId: ensurePublicKey(value?.programId, 'programId'),
    keys: (value?.keys || []).map((entry) => ({
      pubkey: ensurePublicKey(entry?.pubkey ?? entry?.address ?? entry, 'instruction key'),
      isSigner: Boolean(entry?.isSigner),
      isWritable: Boolean(entry?.isWritable)
    })),
    data: ensureBytes(value?.data || new Uint8Array(), 'instruction data')
  });
}

function ensureLookupTableAccount(value) {
  if (value instanceof AddressLookupTableAccount) {
    return value;
  }
  return new AddressLookupTableAccount({
    key: ensurePublicKey(value?.key ?? value?.accountKey, 'lookup table key'),
    state: {
      deactivationSlot: BigInt(
        value?.state?.deactivationSlot ??
          value?.deactivationSlot ??
          '0xffffffffffffffff'
      ),
      lastExtendedSlot: Number(
        value?.state?.lastExtendedSlot ?? value?.lastExtendedSlot ?? 0
      ),
      lastExtendedSlotStartIndex: Number(
        value?.state?.lastExtendedSlotStartIndex ??
          value?.lastExtendedSlotStartIndex ??
          0
      ),
      authority: isPresent(value?.state?.authority ?? value?.authority)
        ? ensurePublicKey(value?.state?.authority ?? value?.authority, 'lookup table authority')
        : undefined,
      addresses: (value?.state?.addresses ?? value?.addresses ?? []).map((address) =>
        ensurePublicKey(address, 'lookup table address')
      )
    }
  });
}

function ensureSigner(value) {
  if (value instanceof Keypair) {
    return value;
  }
  if (value?.secretKey instanceof Uint8Array || Buffer.isBuffer(value?.secretKey)) {
    return Keypair.fromSecretKey(new Uint8Array(value.secretKey));
  }
  if (value instanceof Uint8Array || Buffer.isBuffer(value) || Array.isArray(value)) {
    return Keypair.fromSecretKey(Uint8Array.from(value));
  }
  throw new TypeError('invalid signer');
}

function getMessageAccountKeys(message) {
  return Array.isArray(message.staticAccountKeys) ? message.staticAccountKeys : message.accountKeys;
}

function getCompiledInstructions(message) {
  return Array.isArray(message.compiledInstructions) ? message.compiledInstructions : message.instructions;
}

function normalizeTxFormat(version) {
  return version === 'legacy' ? 'legacy' : `v${version}`;
}

function publicKeyToDer(publicKey) {
  const raw = ensurePublicKey(publicKey).toBytes();
  return new Uint8Array(Buffer.concat([Buffer.from(ED25519_SPKI_PREFIX), Buffer.from(raw)]));
}

function bytesEqual(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right)) === 0;
}

function summarizeAddressTableLookups(message) {
  return (message.addressTableLookups || []).map((lookup) => ({
    account_key: ensurePublicKey(lookup.accountKey).toBase58(),
    writable_indexes: Array.from(lookup.writableIndexes || []),
    readonly_indexes: Array.from(lookup.readonlyIndexes || [])
  }));
}

function summarizeInstructionFallback(message) {
  return getCompiledInstructions(message).map((instruction) => ({
    program_id_index: instruction.programIdIndex,
    account_indexes: Array.from(instruction.accountKeyIndexes || instruction.accounts || []),
    data: typeof instruction.data === 'string' ? instruction.data : base64UrlEncode(instruction.data)
  }));
}

function summarizeInstructions(message) {
  try {
    const decompiled = TransactionMessage.decompile(message);
    return decompiled.instructions.map((instruction) => ({
      program_id: instruction.programId.toBase58(),
      keys: instruction.keys.map((key) => ({
        pubkey: key.pubkey.toBase58(),
        is_signer: key.isSigner,
        is_writable: key.isWritable
      })),
      data: base64UrlEncode(instruction.data)
    }));
  } catch {
    return summarizeInstructionFallback(message);
  }
}

function buildParsedMessage(message, meta = {}) {
  const messageBytes = message.serialize();
  const txFormat = normalizeTxFormat(message.version);
  const accountKeys = getMessageAccountKeys(message);
  const signerCount = Number(message.header.numRequiredSignatures || 0);
  const signerPubkeys = accountKeys.slice(0, signerCount).map((key) => key.toBase58());

  return {
    kind: 'sign_request',
    txFormat,
    messageVersion: txFormat,
    cluster: String(meta.cluster || ''),
    messageBytes,
    serializedTxBytes: null,
    payloadHash: sha256(messageBytes),
    feePayer: accountKeys[0]?.toBase58() || '',
    recentBlockhash: String(message.recentBlockhash || ''),
    requiredSignatures: signerCount,
    signerPubkeys,
    instructionCount: getCompiledInstructions(message).length,
    instructions: summarizeInstructions(message),
    addressTableLookups: summarizeAddressTableLookups(message),
    signatures: [],
    signaturesValid: null,
    packetSizeValid: messageBytes.length <= PACKET_DATA_SIZE,
    lastValidBlockHeight: meta.lastValidBlockHeight ?? '',
    simSlot: meta.simSlot ?? ''
  };
}

function verifyTransactionSignatures(transaction) {
  const messageBytes = transaction.message.serialize();
  const signerPubkeys = getMessageAccountKeys(transaction.message).slice(
    0,
    transaction.message.header.numRequiredSignatures
  );
  const signatureCountValid =
    transaction.signatures.length === transaction.message.header.numRequiredSignatures;
  const checks = signerPubkeys.map((pubkey, index) => {
    const signature = transaction.signatures[index];
    const nonZeroSignature = signature instanceof Uint8Array && signature.some((byte) => byte !== 0);
    const valid =
      Boolean(nonZeroSignature) &&
      verifyEd25519(messageBytes, signature, publicKeyToDer(pubkey));
    return {
      signer: pubkey.toBase58(),
      valid
    };
  });

  return {
    signatureCountValid,
    checks,
    valid: signatureCountValid && checks.every((check) => check.valid)
  };
}

function buildParsedSignedTransaction(transaction, meta = {}) {
  const messageSummary = buildParsedMessage(transaction.message, meta);
  const serializedTxBytes = transaction.serialize();
  const signatureResult = verifyTransactionSignatures(transaction);

  return {
    ...messageSummary,
    kind: 'signed_tx',
    serializedTxBytes,
    payloadHash: sha256(serializedTxBytes),
    signatures: transaction.signatures.map((signature, index) => ({
      signer: messageSummary.signerPubkeys[index] || '',
      signature
    })),
    signaturesValid: signatureResult.valid,
    signatureChecks: signatureResult.checks,
    signatureCountValid: signatureResult.signatureCountValid,
    packetSizeValid: serializedTxBytes.length <= PACKET_DATA_SIZE
  };
}

export function buildMessageBytes(txLike) {
  const format = String(txLike?.format || 'legacy').trim().toLowerCase();
  const feePayer = ensurePublicKey(
    txLike?.feePayer ?? txLike?.payer ?? txLike?.fee_payer,
    'fee payer'
  );
  const recentBlockhash = String(
    txLike?.recentBlockhash ?? txLike?.recent_blockhash ?? ''
  ).trim();
  const instructions = (txLike?.instructions || []).map(ensureInstruction);

  if (!recentBlockhash) {
    throw new TypeError('recentBlockhash is required');
  }

  if (format === 'legacy') {
    const transaction = new Transaction({
      recentBlockhash,
      feePayer
    });
    for (const instruction of instructions) {
      transaction.add(instruction);
    }
    return transaction.compileMessage().serialize();
  }

  if (format === 'v0') {
    const message = new TransactionMessage({
      payerKey: feePayer,
      recentBlockhash,
      instructions
    }).compileToV0Message(
      (txLike?.addressLookupTableAccounts ?? txLike?.address_lookup_table_accounts ?? []).map(
        ensureLookupTableAccount
      )
    );
    return message.serialize();
  }

  throw new TypeError(`unsupported Solana tx format: ${format}`);
}

export function signSolanaTransaction({ txLike, signers = [] }) {
  const format = String(txLike?.format || 'legacy').trim().toLowerCase();
  const normalizedSigners = signers.map(ensureSigner);
  if (!normalizedSigners.length) {
    throw new TypeError('at least one signer is required');
  }

  if (format === 'legacy') {
    const feePayer = ensurePublicKey(
      txLike?.feePayer ?? txLike?.payer ?? txLike?.fee_payer,
      'fee payer'
    );
    const recentBlockhash = String(
      txLike?.recentBlockhash ?? txLike?.recent_blockhash ?? ''
    ).trim();
    const transaction = new Transaction({
      recentBlockhash,
      feePayer
    });
    for (const instruction of (txLike?.instructions || []).map(ensureInstruction)) {
      transaction.add(instruction);
    }
    transaction.sign(...normalizedSigners);
    return parseSolanaTransaction(transaction.serialize());
  }

  if (format === 'v0') {
    const messageBytes = buildMessageBytes(txLike);
    const transaction = new VersionedTransaction(VersionedMessage.deserialize(messageBytes));
    transaction.sign(normalizedSigners);
    return parseSolanaTransaction(transaction.serialize());
  }

  throw new TypeError(`unsupported Solana tx format: ${format}`);
}

export function parseSolanaMessage(messageLike, meta = {}) {
  const messageBytes = ensureBytes(messageLike, 'message bytes');
  return buildParsedMessage(VersionedMessage.deserialize(messageBytes), meta);
}

export function parseSolanaTransaction(transactionLike, meta = {}) {
  const serializedTxBytes = ensureBytes(transactionLike, 'serialized transaction bytes');
  return buildParsedSignedTransaction(
    VersionedTransaction.deserialize(serializedTxBytes),
    meta
  );
}

export function parseSolanaPayload(payloadLike, { kind = 'auto', ...meta } = {}) {
  if (kind === 'sign_request') {
    return parseSolanaMessage(payloadLike, meta);
  }
  if (kind === 'signed_tx') {
    return parseSolanaTransaction(payloadLike, meta);
  }

  const bytes = ensureBytes(payloadLike, 'payload bytes');
  try {
    return parseSolanaTransaction(bytes, meta);
  } catch {
    return parseSolanaMessage(bytes, meta);
  }
}
