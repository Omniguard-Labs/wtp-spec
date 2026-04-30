import { utils } from './ethers-utils.js';

const TX_TYPE_NAME_BY_ID = new Map([
  [0, 'legacy'],
  [1, 'eip2930'],
  [2, 'eip1559'],
  [3, 'eip4844'],
  [4, 'eip7702']
]);

const TX_TYPE_ID_BY_NAME = new Map(
  Array.from(TX_TYPE_NAME_BY_ID.entries()).map(([id, name]) => [name, id])
);

function isPresent(value) {
  return value !== undefined && value !== null && value !== '';
}

function normalizeHex(value, { allowEmpty = true } = {}) {
  if (!isPresent(value)) {
    return allowEmpty ? '0x' : null;
  }
  if (typeof value === 'string') {
    if (!utils.isHexString(value)) {
      throw new TypeError(`invalid hex string: ${value}`);
    }
    if (value === '0x') {
      return '0x';
    }
    return utils.hexlify(value).toLowerCase();
  }
  if (value instanceof Uint8Array) {
    return utils.hexlify(value).toLowerCase();
  }
  throw new TypeError('expected hex string or Uint8Array');
}

function normalizeHexData(value) {
  return normalizeHex(value, { allowEmpty: true });
}

function normalizeAddress(value, { allowNull = true } = {}) {
  if (!isPresent(value)) {
    if (allowNull) {
      return '0x';
    }
    throw new TypeError('address is required');
  }
  return utils.getAddress(String(value)).toLowerCase();
}

function normalizeBytes32(value) {
  return utils.hexZeroPad(normalizeHex(value, { allowEmpty: false }), 32).toLowerCase();
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
    return value.startsWith('0x') || value.startsWith('0X') ? BigInt(value) : BigInt(value.trim());
  }
  throw new TypeError('expected unsigned integer');
}

function encodeUint(value) {
  const big = toBigInt(value, 0n);
  if (big < 0n) {
    throw new TypeError('expected unsigned integer');
  }
  if (big === 0n) {
    return '0x';
  }
  let hex = big.toString(16);
  if (hex.length % 2) {
    hex = `0${hex}`;
  }
  return `0x${hex}`;
}

function decodeUint(value) {
  return value === '0x' ? 0n : BigInt(value);
}

function parseAccessListInput(value) {
  const items = Array.isArray(value) ? value : [];
  return items.map((entry) => {
    if (Array.isArray(entry)) {
      return {
        address: normalizeAddress(entry[0], { allowNull: false }),
        storageKeys: (entry[1] || []).map((item) => normalizeBytes32(item))
      };
    }
    return {
      address: normalizeAddress(entry.address, { allowNull: false }),
      storageKeys: (entry.storageKeys || entry.storage_keys || []).map((item) => normalizeBytes32(item))
    };
  });
}

function encodeAccessList(value) {
  return parseAccessListInput(value).map((entry) => [entry.address, entry.storageKeys]);
}

function decodeAccessList(value) {
  return (value || []).map((entry) => ({
    address: normalizeAddress(entry[0], { allowNull: false }),
    storageKeys: (entry[1] || []).map((item) => normalizeBytes32(item))
  }));
}

function normalizeAuthorizationTuple(value) {
  if (Array.isArray(value)) {
    return {
      chainId: decodeUint(value[0]),
      address: normalizeAddress(value[1], { allowNull: false }),
      nonce: decodeUint(value[2]),
      yParity: Number(decodeUint(value[3])),
      r: utils.hexZeroPad(normalizeHex(value[4], { allowEmpty: false }), 32).toLowerCase(),
      s: utils.hexZeroPad(normalizeHex(value[5], { allowEmpty: false }), 32).toLowerCase()
    };
  }
  return {
    chainId: toBigInt(value.chainId ?? value.chain_id),
    address: normalizeAddress(value.address, { allowNull: false }),
    nonce: toBigInt(value.nonce),
    yParity: Number(toBigInt(value.yParity ?? value.y_parity)),
    r: utils.hexZeroPad(normalizeHex(value.r, { allowEmpty: false }), 32).toLowerCase(),
    s: utils.hexZeroPad(normalizeHex(value.s, { allowEmpty: false }), 32).toLowerCase()
  };
}

function encodeAuthorizationList(value) {
  return (Array.isArray(value) ? value : []).map((entry) => {
    const tuple = normalizeAuthorizationTuple(entry);
    return [
      encodeUint(tuple.chainId),
      tuple.address,
      encodeUint(tuple.nonce),
      encodeUint(tuple.yParity),
      encodeUint(tuple.r),
      encodeUint(tuple.s)
    ];
  });
}

function decodeAuthorizationList(value) {
  return (value || []).map((entry) => {
    const tuple = normalizeAuthorizationTuple(entry);
    return {
      ...tuple,
      authority: recoverEip7702Authorization(tuple)
    };
  });
}

function resolveTxType(value) {
  if (!isPresent(value)) {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  const normalized = String(value).trim().toLowerCase();
  if (TX_TYPE_ID_BY_NAME.has(normalized)) {
    return TX_TYPE_ID_BY_NAME.get(normalized);
  }
  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }
  throw new TypeError(`unsupported tx type: ${value}`);
}

function inferTxType(tx) {
  const explicit = resolveTxType(tx.type ?? tx.txType ?? tx.tx_type);
  if (explicit !== null) {
    return explicit;
  }
  if (Array.isArray(tx.authorizationList) || Array.isArray(tx.authorization_list)) {
    return 4;
  }
  if (isPresent(tx.maxFeePerBlobGas) || isPresent(tx.max_fee_per_blob_gas)) {
    return 3;
  }
  if (isPresent(tx.maxFeePerGas) || isPresent(tx.max_fee_per_gas)) {
    return 2;
  }
  if (Array.isArray(tx.accessList) || Array.isArray(tx.access_list)) {
    return 1;
  }
  return 0;
}

function buildUnsignedFields(txLike) {
  const type = inferTxType(txLike);
  const chainId = toBigInt(txLike.chainId ?? txLike.chain_id);
  const nonce = toBigInt(txLike.nonce);
  const gasLimit = toBigInt(txLike.gasLimit ?? txLike.gas_limit);
  const to = normalizeAddress(txLike.to ?? txLike.destination, { allowNull: type !== 3 && type !== 4 });
  const value = toBigInt(txLike.value ?? txLike.amount);
  const data = normalizeHexData(txLike.data ?? txLike.input ?? '0x');
  const accessList = encodeAccessList(txLike.accessList ?? txLike.access_list);

  if (type === 0) {
    return {
      type,
      fields: [
        encodeUint(nonce),
        encodeUint(txLike.gasPrice ?? txLike.gas_price),
        encodeUint(gasLimit),
        to,
        encodeUint(value),
        data,
        encodeUint(chainId),
        '0x',
        '0x'
      ]
    };
  }

  if (type === 1) {
    return {
      type,
      fields: [
        encodeUint(chainId),
        encodeUint(nonce),
        encodeUint(txLike.gasPrice ?? txLike.gas_price),
        encodeUint(gasLimit),
        to,
        encodeUint(value),
        data,
        accessList
      ]
    };
  }

  if (type === 2) {
    return {
      type,
      fields: [
        encodeUint(chainId),
        encodeUint(nonce),
        encodeUint(txLike.maxPriorityFeePerGas ?? txLike.max_priority_fee_per_gas),
        encodeUint(txLike.maxFeePerGas ?? txLike.max_fee_per_gas),
        encodeUint(gasLimit),
        to,
        encodeUint(value),
        data,
        accessList
      ]
    };
  }

  if (type === 3) {
    return {
      type,
      fields: [
        encodeUint(chainId),
        encodeUint(nonce),
        encodeUint(txLike.maxPriorityFeePerGas ?? txLike.max_priority_fee_per_gas),
        encodeUint(txLike.maxFeePerGas ?? txLike.max_fee_per_gas),
        encodeUint(gasLimit),
        to,
        encodeUint(value),
        data,
        accessList,
        encodeUint(txLike.maxFeePerBlobGas ?? txLike.max_fee_per_blob_gas),
        (txLike.blobVersionedHashes ?? txLike.blob_versioned_hashes ?? []).map((item) =>
          normalizeBytes32(item)
        )
      ]
    };
  }

  if (type === 4) {
    return {
      type,
      fields: [
        encodeUint(chainId),
        encodeUint(nonce),
        encodeUint(txLike.maxPriorityFeePerGas ?? txLike.max_priority_fee_per_gas),
        encodeUint(txLike.maxFeePerGas ?? txLike.max_fee_per_gas),
        encodeUint(gasLimit),
        to,
        encodeUint(value),
        data,
        accessList,
        encodeAuthorizationList(txLike.authorizationList ?? txLike.authorization_list)
      ]
    };
  }

  throw new TypeError(`unsupported tx type: ${type}`);
}

function hexTypePrefix(type) {
  return utils.hexlify(Uint8Array.of(type));
}

function appendSignatureFields(type, unsignedFields, signature, chainId) {
  const r = encodeUint(signature.r);
  const s = encodeUint(signature.s);
  if (type === 0) {
    const yParity = BigInt(signature.yParity);
    const v = chainId > 0n ? chainId * 2n + 35n + yParity : 27n + yParity;
    return [...unsignedFields.slice(0, 6), encodeUint(v), r, s];
  }
  return [...unsignedFields, encodeUint(signature.yParity), r, s];
}

function buildTypedTransactionHex(type, fields) {
  return utils.hexConcat([hexTypePrefix(type), utils.RLP.encode(fields)]).toLowerCase();
}

function recoveryParamsFromSignature({ r, s, yParity }) {
  return {
    r: utils.hexZeroPad(normalizeHex(r, { allowEmpty: false }), 32),
    s: utils.hexZeroPad(normalizeHex(s, { allowEmpty: false }), 32),
    recoveryParam: Number(yParity)
  };
}

function detectLegacySigned(decodedFields) {
  if (decodedFields.length !== 9) {
    throw new Error('invalid legacy tx field count');
  }
  return decodedFields[7] !== '0x' || decodedFields[8] !== '0x';
}

function parseCommonAccessListFields(
  fields,
  { gasLimitIndex, toIndex, valueIndex, dataIndex, accessListIndex }
) {
  return {
    chainId: decodeUint(fields[0]),
    nonce: decodeUint(fields[1]),
    gasLimit: decodeUint(fields[gasLimitIndex]),
    to: normalizeAddress(fields[toIndex], { allowNull: true }),
    value: decodeUint(fields[valueIndex]),
    data: normalizeHexData(fields[dataIndex]),
    accessList: decodeAccessList(fields[accessListIndex])
  };
}

export function describeTxType(type) {
  return TX_TYPE_NAME_BY_ID.get(type) || `unknown:${type}`;
}

export function buildUnsignedTransaction(txLike) {
  const { type, fields } = buildUnsignedFields(txLike);
  if (type === 0) {
    return utils.RLP.encode(fields).toLowerCase();
  }
  return buildTypedTransactionHex(type, fields);
}

export function signEvmTransaction(txLike, privateKey) {
  const unsignedTxHex = buildUnsignedTransaction(txLike);
  const unsignedTx = parseEvmTransaction(unsignedTxHex);
  const signingKey = new utils.SigningKey(privateKey);
  const signature = signingKey.signDigest(unsignedTx.signableHash);
  const { type, fields } = buildUnsignedFields(txLike);
  const signedFields = appendSignatureFields(
    type,
    fields,
    {
      yParity: signature.recoveryParam,
      r: signature.r,
      s: signature.s
    },
    unsignedTx.chainId
  );

  const serializedTxHex =
    type === 0
      ? utils.RLP.encode(signedFields).toLowerCase()
      : buildTypedTransactionHex(type, signedFields);

  return parseEvmTransaction(serializedTxHex);
}

export function signEip7702Authorization({ chainId, address, nonce, privateKey }) {
  const payload = utils.RLP.encode([
    encodeUint(chainId),
    normalizeAddress(address, { allowNull: false }),
    encodeUint(nonce)
  ]);
  const digest = utils.keccak256(utils.hexConcat(['0x05', payload]));
  const signingKey = new utils.SigningKey(privateKey);
  const signature = signingKey.signDigest(digest);
  return {
    chainId: toBigInt(chainId),
    address: normalizeAddress(address, { allowNull: false }),
    nonce: toBigInt(nonce),
    yParity: signature.recoveryParam,
    r: utils.hexZeroPad(signature.r, 32).toLowerCase(),
    s: utils.hexZeroPad(signature.s, 32).toLowerCase(),
    authority: utils.computeAddress(privateKey).toLowerCase(),
    digest
  };
}

export function recoverEip7702Authorization(tupleLike) {
  const tuple = normalizeAuthorizationTuple(tupleLike);
  const payload = utils.RLP.encode([
    encodeUint(tuple.chainId),
    tuple.address,
    encodeUint(tuple.nonce)
  ]);
  const digest = utils.keccak256(utils.hexConcat(['0x05', payload]));
  return utils
    .recoverAddress(digest, recoveryParamsFromSignature(tuple))
    .toLowerCase();
}

function parseLegacyTransaction(serializedHex) {
  const decoded = utils.RLP.decode(serializedHex);
  if (!Array.isArray(decoded) || decoded.length !== 9) {
    throw new Error('invalid legacy transaction');
  }

  const signed = detectLegacySigned(decoded);
  const nonce = decodeUint(decoded[0]);
  const gasPrice = decodeUint(decoded[1]);
  const gasLimit = decodeUint(decoded[2]);
  const to = normalizeAddress(decoded[3], { allowNull: true });
  const value = decodeUint(decoded[4]);
  const data = normalizeHexData(decoded[5]);

  if (!signed) {
    const chainId = decodeUint(decoded[6]);
    const unsignedTxHex = utils.RLP.encode(decoded).toLowerCase();
    return {
      kind: 'sign_request',
      txType: 0,
      txTypeName: describeTxType(0),
      chainId,
      nonce,
      gasLimit,
      gasPrice,
      to,
      value,
      data,
      accessList: [],
      unsignedTxHex,
      signableHash: utils.keccak256(unsignedTxHex),
      payloadHash: utils.keccak256(unsignedTxHex),
      serializedTxHex: null,
      txHash: null,
      from: null,
      signature: null,
      blobVersionedHashes: [],
      authorizationList: []
    };
  }

  const v = decodeUint(decoded[6]);
  const r = utils.hexZeroPad(normalizeHex(decoded[7], { allowEmpty: false }), 32).toLowerCase();
  const s = utils.hexZeroPad(normalizeHex(decoded[8], { allowEmpty: false }), 32).toLowerCase();

  let chainId = 0n;
  let yParity = 0;
  if (v === 27n || v === 28n) {
    yParity = Number(v - 27n);
  } else {
    chainId = (v - 35n) / 2n;
    yParity = Number((v - 35n) % 2n);
  }

  const unsignedFields =
    chainId > 0n
      ? [...decoded.slice(0, 6), encodeUint(chainId), '0x', '0x']
      : decoded.slice(0, 6);
  const unsignedTxHex = utils.RLP.encode(unsignedFields).toLowerCase();
  const signableHash = utils.keccak256(unsignedTxHex);
  const from = utils
    .recoverAddress(signableHash, recoveryParamsFromSignature({ r, s, yParity }))
    .toLowerCase();

  return {
    kind: 'signed_tx',
    txType: 0,
    txTypeName: describeTxType(0),
    chainId,
    nonce,
    gasLimit,
    gasPrice,
    to,
    value,
    data,
    accessList: [],
    unsignedTxHex,
    signableHash,
    payloadHash: utils.keccak256(serializedHex),
    serializedTxHex: serializedHex.toLowerCase(),
    txHash: utils.keccak256(serializedHex),
    from,
    signature: { v, yParity, r, s },
    blobVersionedHashes: [],
    authorizationList: []
  };
}

function parseTypedTransaction(type, serializedHex) {
  const bodyHex = utils.hexDataSlice(serializedHex, 1);
  const decoded = utils.RLP.decode(bodyHex);
  if (!Array.isArray(decoded)) {
    throw new Error('invalid typed transaction');
  }

  if (type === 1) {
    if (decoded.length !== 8 && decoded.length !== 11) {
      throw new Error('invalid EIP-2930 field count');
    }
    const signed = decoded.length === 11;
    const common = parseCommonAccessListFields(decoded, {
      gasLimitIndex: 3,
      toIndex: 4,
      valueIndex: 5,
      dataIndex: 6,
      accessListIndex: 7
    });
    const gasPrice = decodeUint(decoded[2]);
    const unsignedFields = decoded.slice(0, 8);
    const unsignedTxHex = buildTypedTransactionHex(type, unsignedFields);
    const result = {
      kind: signed ? 'signed_tx' : 'sign_request',
      txType: type,
      txTypeName: describeTxType(type),
      chainId: common.chainId,
      nonce: common.nonce,
      gasLimit: common.gasLimit,
      gasPrice,
      to: common.to,
      value: common.value,
      data: common.data,
      accessList: common.accessList,
      unsignedTxHex,
      signableHash: utils.keccak256(unsignedTxHex),
      payloadHash: utils.keccak256(signed ? serializedHex : unsignedTxHex),
      serializedTxHex: signed ? serializedHex.toLowerCase() : null,
      txHash: signed ? utils.keccak256(serializedHex) : null,
      from: null,
      signature: null,
      blobVersionedHashes: [],
      authorizationList: []
    };
    if (!signed) {
      return result;
    }
    const yParity = Number(decodeUint(decoded[8]));
    const r = utils.hexZeroPad(normalizeHex(decoded[9], { allowEmpty: false }), 32).toLowerCase();
    const s = utils.hexZeroPad(normalizeHex(decoded[10], { allowEmpty: false }), 32).toLowerCase();
    result.signature = { yParity, r, s };
    result.from = utils
      .recoverAddress(result.signableHash, recoveryParamsFromSignature({ yParity, r, s }))
      .toLowerCase();
    return result;
  }

  if (type === 2) {
    if (decoded.length !== 9 && decoded.length !== 12) {
      throw new Error('invalid EIP-1559 field count');
    }
    const signed = decoded.length === 12;
    const common = parseCommonAccessListFields(decoded, {
      gasLimitIndex: 4,
      toIndex: 5,
      valueIndex: 6,
      dataIndex: 7,
      accessListIndex: 8
    });
    const maxPriorityFeePerGas = decodeUint(decoded[2]);
    const maxFeePerGas = decodeUint(decoded[3]);
    const unsignedFields = decoded.slice(0, 9);
    const unsignedTxHex = buildTypedTransactionHex(type, unsignedFields);
    const result = {
      kind: signed ? 'signed_tx' : 'sign_request',
      txType: type,
      txTypeName: describeTxType(type),
      chainId: common.chainId,
      nonce: common.nonce,
      gasLimit: common.gasLimit,
      maxPriorityFeePerGas,
      maxFeePerGas,
      to: common.to,
      value: common.value,
      data: common.data,
      accessList: common.accessList,
      unsignedTxHex,
      signableHash: utils.keccak256(unsignedTxHex),
      payloadHash: utils.keccak256(signed ? serializedHex : unsignedTxHex),
      serializedTxHex: signed ? serializedHex.toLowerCase() : null,
      txHash: signed ? utils.keccak256(serializedHex) : null,
      from: null,
      signature: null,
      blobVersionedHashes: [],
      authorizationList: []
    };
    if (!signed) {
      return result;
    }
    const yParity = Number(decodeUint(decoded[9]));
    const r = utils.hexZeroPad(normalizeHex(decoded[10], { allowEmpty: false }), 32).toLowerCase();
    const s = utils.hexZeroPad(normalizeHex(decoded[11], { allowEmpty: false }), 32).toLowerCase();
    result.signature = { yParity, r, s };
    result.from = utils
      .recoverAddress(result.signableHash, recoveryParamsFromSignature({ yParity, r, s }))
      .toLowerCase();
    return result;
  }

  if (type === 3) {
    if (decoded.length !== 11 && decoded.length !== 14) {
      throw new Error('invalid EIP-4844 field count');
    }
    const signed = decoded.length === 14;
    const common = parseCommonAccessListFields(decoded, {
      gasLimitIndex: 4,
      toIndex: 5,
      valueIndex: 6,
      dataIndex: 7,
      accessListIndex: 8
    });
    const maxPriorityFeePerGas = decodeUint(decoded[2]);
    const maxFeePerGas = decodeUint(decoded[3]);
    const maxFeePerBlobGas = decodeUint(decoded[9]);
    const blobVersionedHashes = (decoded[10] || []).map((item) => normalizeBytes32(item));
    const unsignedFields = decoded.slice(0, 11);
    const unsignedTxHex = buildTypedTransactionHex(type, unsignedFields);
    const result = {
      kind: signed ? 'signed_tx' : 'sign_request',
      txType: type,
      txTypeName: describeTxType(type),
      chainId: common.chainId,
      nonce: common.nonce,
      gasLimit: common.gasLimit,
      maxPriorityFeePerGas,
      maxFeePerGas,
      maxFeePerBlobGas,
      to: common.to,
      value: common.value,
      data: common.data,
      accessList: common.accessList,
      blobVersionedHashes,
      unsignedTxHex,
      signableHash: utils.keccak256(unsignedTxHex),
      payloadHash: utils.keccak256(signed ? serializedHex : unsignedTxHex),
      serializedTxHex: signed ? serializedHex.toLowerCase() : null,
      txHash: signed ? utils.keccak256(serializedHex) : null,
      from: null,
      signature: null,
      authorizationList: []
    };
    if (!signed) {
      return result;
    }
    const yParity = Number(decodeUint(decoded[11]));
    const r = utils.hexZeroPad(normalizeHex(decoded[12], { allowEmpty: false }), 32).toLowerCase();
    const s = utils.hexZeroPad(normalizeHex(decoded[13], { allowEmpty: false }), 32).toLowerCase();
    result.signature = { yParity, r, s };
    result.from = utils
      .recoverAddress(result.signableHash, recoveryParamsFromSignature({ yParity, r, s }))
      .toLowerCase();
    return result;
  }

  if (type === 4) {
    if (decoded.length !== 10 && decoded.length !== 13) {
      throw new Error('invalid EIP-7702 field count');
    }
    const signed = decoded.length === 13;
    const common = parseCommonAccessListFields(decoded, {
      gasLimitIndex: 4,
      toIndex: 5,
      valueIndex: 6,
      dataIndex: 7,
      accessListIndex: 8
    });
    const maxPriorityFeePerGas = decodeUint(decoded[2]);
    const maxFeePerGas = decodeUint(decoded[3]);
    const authorizationList = decodeAuthorizationList(decoded[9]);
    const unsignedFields = decoded.slice(0, 10);
    const unsignedTxHex = buildTypedTransactionHex(type, unsignedFields);
    const result = {
      kind: signed ? 'signed_tx' : 'sign_request',
      txType: type,
      txTypeName: describeTxType(type),
      chainId: common.chainId,
      nonce: common.nonce,
      gasLimit: common.gasLimit,
      maxPriorityFeePerGas,
      maxFeePerGas,
      to: common.to,
      value: common.value,
      data: common.data,
      accessList: common.accessList,
      authorizationList,
      unsignedTxHex,
      signableHash: utils.keccak256(unsignedTxHex),
      payloadHash: utils.keccak256(signed ? serializedHex : unsignedTxHex),
      serializedTxHex: signed ? serializedHex.toLowerCase() : null,
      txHash: signed ? utils.keccak256(serializedHex) : null,
      from: null,
      signature: null,
      blobVersionedHashes: []
    };
    if (!signed) {
      return result;
    }
    const yParity = Number(decodeUint(decoded[10]));
    const r = utils.hexZeroPad(normalizeHex(decoded[11], { allowEmpty: false }), 32).toLowerCase();
    const s = utils.hexZeroPad(normalizeHex(decoded[12], { allowEmpty: false }), 32).toLowerCase();
    result.signature = { yParity, r, s };
    result.from = utils
      .recoverAddress(result.signableHash, recoveryParamsFromSignature({ yParity, r, s }))
      .toLowerCase();
    return result;
  }

  throw new Error(`unsupported typed tx: ${type}`);
}

export function parseEvmTransaction(serializedInput) {
  const serializedHex = normalizeHex(serializedInput, { allowEmpty: false });
  const bytes = utils.arrayify(serializedHex);
  const firstByte = bytes[0];

  if (firstByte >= 0xc0) {
    return parseLegacyTransaction(serializedHex);
  }
  if (!TX_TYPE_NAME_BY_ID.has(firstByte)) {
    throw new Error(`unsupported tx type byte: 0x${firstByte.toString(16)}`);
  }
  return parseTypedTransaction(firstByte, serializedHex);
}
