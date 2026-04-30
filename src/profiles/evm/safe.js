import { cborDecode, cborEncode } from '../../core/cbor.js';
import { utils } from './ethers-utils.js';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const DOMAIN_SEPARATOR_TYPEHASH = utils.id(
  'EIP712Domain(uint256 chainId,address verifyingContract)'
);
const SAFE_TX_TYPEHASH = utils.id(
  'SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)'
);
const SECP256K1_ORDER = BigInt(
  '0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'
);
const SECP256K1_HALF_ORDER = SECP256K1_ORDER / 2n;
const abiCoder = utils.AbiCoder.defaultAbiCoder();
const safeInterface = new utils.Interface([
  'function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,bytes signatures) returns (bool success)'
]);

function isPresent(value) {
  return value !== undefined && value !== null && value !== '';
}

function toBigInt(value, fallback = 0n) {
  if (!isPresent(value)) {
    return fallback;
  }
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
      throw new TypeError('expected unsigned integer');
    }
    return BigInt(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.startsWith('0x') || trimmed.startsWith('0X')
      ? BigInt(trimmed)
      : BigInt(trimmed || '0');
  }
  throw new TypeError('expected unsigned integer');
}

function uintString(value, fallback = 0n) {
  const big = toBigInt(value, fallback);
  if (big < 0n) {
    throw new TypeError('expected unsigned integer');
  }
  return big.toString(10);
}

function normalizeAddress(value, fieldName, { allowDefaultZero = false } = {}) {
  if (!isPresent(value)) {
    if (allowDefaultZero) {
      return ZERO_ADDRESS;
    }
    throw new TypeError(`${fieldName} is required`);
  }
  return utils.getAddress(String(value)).toLowerCase();
}

function normalizeHexData(value) {
  if (!isPresent(value)) {
    return '0x';
  }
  if (value instanceof Uint8Array) {
    return utils.hexlify(value).toLowerCase();
  }
  if (typeof value === 'string') {
    return utils.hexlify(value).toLowerCase();
  }
  throw new TypeError('expected bytes');
}

function normalizeOperation(value) {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'call') {
      return 0;
    }
    if (normalized === 'delegatecall') {
      return 1;
    }
  }
  const operation = Number(toBigInt(value, 0n));
  if (operation !== 0 && operation !== 1) {
    throw new TypeError('Safe operation must be 0/call or 1/delegatecall');
  }
  return operation;
}

function bytesToBigInt(bytes) {
  const hex = utils.hexlify(bytes);
  return hex === '0x' ? 0n : BigInt(hex);
}

function wordToAddress(wordHex) {
  return utils.getAddress(utils.hexDataSlice(wordHex, 12)).toLowerCase();
}

function hexUint256(value) {
  return utils.hexZeroPad(`0x${value.toString(16)}`, 32).toLowerCase();
}

function normalizeSafeEcdsaSignature({ r, s, v }) {
  const sValue = BigInt(s);
  if (sValue > SECP256K1_HALF_ORDER && sValue < SECP256K1_ORDER) {
    if (v !== 27 && v !== 28) {
      return { r, s, v };
    }
    return {
      r,
      s: hexUint256(SECP256K1_ORDER - sValue),
      v: v === 27 ? 28 : 27
    };
  }
  return { r, s, v };
}

function recoverSafeEcdsaSigner(digest, signature) {
  return utils
    .recoverAddress(digest, normalizeSafeEcdsaSignature(signature))
    .toLowerCase();
}

function safeTxAbiValues(safeTx) {
  return [
    safeTx.to,
    BigInt(safeTx.value),
    safeTx.data,
    Number(safeTx.operation),
    BigInt(safeTx.safe_tx_gas),
    BigInt(safeTx.base_gas),
    BigInt(safeTx.gas_price),
    safeTx.gas_token,
    safeTx.refund_receiver,
    BigInt(safeTx.nonce)
  ];
}

export function normalizeSafeTransaction(txLike) {
  return {
    version: Number(txLike?.version || 1),
    safe: normalizeAddress(txLike?.safe ?? txLike?.safe_address, 'safe'),
    chain_id: uintString(txLike?.chainId ?? txLike?.chain_id),
    to: normalizeAddress(txLike?.to, 'to'),
    value: uintString(txLike?.value),
    data: normalizeHexData(txLike?.data),
    operation: normalizeOperation(txLike?.operation),
    safe_tx_gas: uintString(txLike?.safeTxGas ?? txLike?.safe_tx_gas),
    base_gas: uintString(txLike?.baseGas ?? txLike?.base_gas),
    gas_price: uintString(txLike?.gasPrice ?? txLike?.gas_price),
    gas_token: normalizeAddress(
      txLike?.gasToken ?? txLike?.gas_token,
      'gasToken',
      { allowDefaultZero: true }
    ),
    refund_receiver: normalizeAddress(
      txLike?.refundReceiver ?? txLike?.refund_receiver,
      'refundReceiver',
      { allowDefaultZero: true }
    ),
    nonce: uintString(txLike?.nonce)
  };
}

export function encodeSafeTransaction(safeTxLike) {
  return cborEncode(normalizeSafeTransaction(safeTxLike));
}

export function decodeSafeTransaction(bytes) {
  return normalizeSafeTransaction(cborDecode(bytes));
}

export function getSafeDomainSeparator(safeTxLike) {
  const safeTx = normalizeSafeTransaction(safeTxLike);
  return utils.keccak256(
    abiCoder.encode(
      ['bytes32', 'uint256', 'address'],
      [DOMAIN_SEPARATOR_TYPEHASH, BigInt(safeTx.chain_id), safeTx.safe]
    )
  );
}

export function getSafeTransactionStructHash(safeTxLike) {
  const safeTx = normalizeSafeTransaction(safeTxLike);
  return utils.keccak256(
    abiCoder.encode(
      [
        'bytes32',
        'address',
        'uint256',
        'bytes32',
        'uint8',
        'uint256',
        'uint256',
        'uint256',
        'address',
        'address',
        'uint256'
      ],
      [
        SAFE_TX_TYPEHASH,
        safeTx.to,
        BigInt(safeTx.value),
        utils.keccak256(safeTx.data),
        Number(safeTx.operation),
        BigInt(safeTx.safe_tx_gas),
        BigInt(safeTx.base_gas),
        BigInt(safeTx.gas_price),
        safeTx.gas_token,
        safeTx.refund_receiver,
        BigInt(safeTx.nonce)
      ]
    )
  );
}

export function getSafeTransactionHash(safeTxLike) {
  const domainSeparator = getSafeDomainSeparator(safeTxLike);
  const structHash = getSafeTransactionStructHash(safeTxLike);
  return utils.keccak256(utils.hexConcat(['0x1901', domainSeparator, structHash]));
}

export function signSafeTransaction({
  safeTx,
  privateKey,
  privateKeys,
  signatureType = 'eip712'
}) {
  const keys = privateKeys || (privateKey ? [privateKey] : []);
  if (!keys.length) {
    throw new TypeError('at least one private key is required');
  }
  const safeTxHash = getSafeTransactionHash(safeTx);
  const normalizedSignatureType = String(signatureType || 'eip712').trim().toLowerCase();
  if (normalizedSignatureType !== 'eip712' && normalizedSignatureType !== 'eth_sign') {
    throw new TypeError(`unsupported Safe signature type: ${signatureType}`);
  }
  const digest =
    normalizedSignatureType === 'eth_sign'
      ? utils.hashMessage(utils.arrayify(safeTxHash))
      : safeTxHash;

  const chunks = keys.map((key) => {
    const signingKey = new utils.SigningKey(key);
    const signature = signingKey.signDigest(digest);
    const v =
      normalizedSignatureType === 'eth_sign'
        ? Number(signature.v) + 4
        : Number(signature.v);
    return {
      signer: utils.computeAddress(key).toLowerCase(),
      signature: utils.hexConcat([
        utils.hexZeroPad(signature.r, 32),
        utils.hexZeroPad(signature.s, 32),
        utils.hexlify(Uint8Array.of(v))
      ])
    };
  });

  chunks.sort((left, right) => left.signer.localeCompare(right.signer));
  return {
    safeTxHash,
    signatures: utils.hexConcat(chunks.map((chunk) => chunk.signature)),
    signers: chunks.map((chunk) => chunk.signer),
    signatureType: normalizedSignatureType
  };
}

export function parseSafeSignatures(
  signaturesLike,
  { safeTxHash, expectedOwners = null, expectedThreshold = null } = {}
) {
  const signaturesHex = normalizeHexData(signaturesLike);
  const bytes = utils.arrayify(signaturesHex);
  const dynamicOffsets = [];
  let staticLength = bytes.length;

  for (
    let index = 0;
    index * 65 + 65 <= staticLength && index * 65 + 65 <= bytes.length;
    index += 1
  ) {
    const offset = index * 65;
    const s = bytesToBigInt(bytes.slice(offset + 32, offset + 64));
    const v = bytes[offset + 64];
    if (v === 0 || v === 2) {
      dynamicOffsets.push({
        offset: s,
        minStaticLength: BigInt(offset + 65)
      });
      if (s < BigInt(staticLength)) {
        staticLength = Number(s);
      }
    }
  }

  const dynamicOffsetsValid = dynamicOffsets.every(
    (item) =>
      item.offset >= item.minStaticLength &&
      item.offset <= BigInt(bytes.length) &&
      item.offset % 65n === 0n
  );
  const layoutValid =
    Number.isSafeInteger(staticLength) &&
    staticLength >= 0 &&
    staticLength <= bytes.length &&
    staticLength % 65 === 0 &&
    dynamicOffsetsValid &&
    (dynamicOffsets.length ? staticLength > 0 : bytes.length % 65 === 0);
  const staticCount = layoutValid ? staticLength / 65 : 0;
  const parsed = [];

  for (let index = 0; index < staticCount; index += 1) {
    const offset = index * 65;
    const r = utils.hexlify(bytes.slice(offset, offset + 32)).toLowerCase();
    const s = utils.hexlify(bytes.slice(offset + 32, offset + 64)).toLowerCase();
    const v = bytes[offset + 64];
    const item = {
      index,
      r,
      s,
      v,
      signer: '',
      signature_type: 'unknown',
      verified_offline: false,
      requires_onchain_check: false,
      reason: ''
    };

    try {
      if (v === 0) {
        const dataOffset = Number(bytesToBigInt(bytes.slice(offset + 32, offset + 64)));
        item.signer = wordToAddress(r);
        item.signature_type = 'eip1271_contract';
        item.requires_onchain_check = true;
        item.reason = 'requires_eip1271_call';
        if (dataOffset + 32 <= bytes.length) {
          const dataLength = Number(bytesToBigInt(bytes.slice(dataOffset, dataOffset + 32)));
          if (Number.isSafeInteger(dataLength) && dataOffset + 32 + dataLength <= bytes.length) {
            item.dynamic_data = utils
              .hexlify(bytes.slice(dataOffset + 32, dataOffset + 32 + dataLength))
              .toLowerCase();
          }
        }
      } else if (v === 1) {
        item.signer = wordToAddress(r);
        item.signature_type = 'approved_hash';
        item.requires_onchain_check = true;
        item.reason = 'requires_approved_hash_state';
      } else if (v === 2) {
        item.signer = wordToAddress(r);
        item.signature_type = 'secp256r1';
        item.requires_onchain_check = true;
        item.reason = 'requires_p256_verification';
      } else if (v > 30) {
        item.signer = recoverSafeEcdsaSigner(
          utils.hashMessage(utils.arrayify(safeTxHash)),
          { r, s, v: v - 4 }
        );
        item.signature_type = 'eth_sign';
        item.verified_offline = true;
      } else if (v === 27 || v === 28) {
        item.signer = recoverSafeEcdsaSigner(safeTxHash, { r, s, v });
        item.signature_type = 'eip712';
        item.verified_offline = true;
      } else {
        item.reason = 'unsupported_signature_type';
      }
    } catch (error) {
      item.reason = error instanceof Error ? error.message : 'signature_recovery_failed';
    }

    parsed.push(item);
  }

  const signerItems = parsed.filter((item) => item.signer);
  const signersSorted = signerItems.every(
    (item, index) => index === 0 || item.signer > signerItems[index - 1].signer
  );
  const recoveredSigners = parsed
    .filter((item) => item.verified_offline)
    .map((item) => item.signer);
  const expectedOwnerSet = Array.isArray(expectedOwners)
    ? new Set(expectedOwners.map((owner) => utils.getAddress(owner).toLowerCase()))
    : null;
  const ownersValid =
    !expectedOwnerSet || signerItems.every((item) => expectedOwnerSet.has(item.signer));
  const thresholdValid =
    expectedThreshold === null ||
    expectedThreshold === undefined ||
    signerItems.length >= Number(expectedThreshold);
  const unsupportedCount = parsed.filter((item) => item.requires_onchain_check || item.reason).length;
  const offlineVerified =
    layoutValid &&
    parsed.length > 0 &&
    unsupportedCount === 0 &&
    parsed.every((item) => item.verified_offline) &&
    signersSorted &&
    ownersValid &&
    thresholdValid;

  return {
    signatures: signaturesHex,
    count: parsed.length,
    parsed,
    recoveredSigners,
    unsupportedCount,
    layoutValid,
    signersSorted,
    ownersValid,
    thresholdValid,
    offlineVerified
  };
}

export function buildSafeExecTransactionCalldata({ safeTx, signatures }) {
  const normalized = normalizeSafeTransaction(safeTx);
  return safeInterface.encodeFunctionData('execTransaction', [
    ...safeTxAbiValues(normalized).slice(0, 9),
    normalizeHexData(signatures)
  ]);
}

export function parseSafeExecTransactionCalldata(calldata, { safe, chainId, nonce }) {
  if (!isPresent(nonce)) {
    throw new TypeError('Safe nonce is required when parsing execTransaction calldata');
  }
  const decoded = safeInterface.decodeFunctionData(
    'execTransaction',
    normalizeHexData(calldata)
  );
  const safeTx = normalizeSafeTransaction({
    safe,
    chainId,
    to: decoded[0],
    value: decoded[1],
    data: decoded[2],
    operation: decoded[3],
    safeTxGas: decoded[4],
    baseGas: decoded[5],
    gasPrice: decoded[6],
    gasToken: decoded[7],
    refundReceiver: decoded[8],
    nonce
  });
  return {
    safeTx,
    signatures: normalizeHexData(decoded[9] ?? decoded.signatures)
  };
}
