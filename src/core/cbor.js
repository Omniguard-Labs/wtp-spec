import { Buffer } from 'node:buffer';

function isPlainObject(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function toUint8Array(value) {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (Buffer.isBuffer(value)) {
    return new Uint8Array(value);
  }
  throw new TypeError('expected Uint8Array');
}

function concatBytes(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function utf8Encode(value) {
  return new TextEncoder().encode(String(value));
}

function utf8Decode(value) {
  return new TextDecoder().decode(value);
}

function compareBytes(left, right) {
  if (left.length !== right.length) {
    return left.length - right.length;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }
  return 0;
}

function encodeMajorType(majorType, value) {
  if (!Number.isInteger(majorType) || majorType < 0 || majorType > 7) {
    throw new TypeError('invalid CBOR major type');
  }
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError('invalid CBOR length');
  }
  const initial = majorType << 5;
  if (value < 24) {
    return Uint8Array.of(initial | value);
  }
  if (value < 0x100) {
    return Uint8Array.of(initial | 24, value);
  }
  if (value < 0x10000) {
    return Uint8Array.of(initial | 25, value >> 8, value & 0xff);
  }
  if (value < 0x100000000) {
    return Uint8Array.of(
      initial | 26,
      (value >>> 24) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 8) & 0xff,
      value & 0xff
    );
  }
  const high = Math.floor(value / 0x100000000);
  const low = value >>> 0;
  return Uint8Array.of(
    initial | 27,
    (high >>> 24) & 0xff,
    (high >>> 16) & 0xff,
    (high >>> 8) & 0xff,
    high & 0xff,
    (low >>> 24) & 0xff,
    (low >>> 16) & 0xff,
    (low >>> 8) & 0xff,
    low & 0xff
  );
}

function encodeInteger(value) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new TypeError('CBOR integer must be a safe integer');
  }
  if (value >= 0) {
    return encodeMajorType(0, value);
  }
  return encodeMajorType(1, -1 - value);
}

function encodeBytes(value) {
  const bytes = toUint8Array(value);
  return concatBytes([encodeMajorType(2, bytes.length), bytes]);
}

function encodeString(value) {
  const bytes = utf8Encode(value);
  return concatBytes([encodeMajorType(3, bytes.length), bytes]);
}

function normalizeMapEntries(value) {
  if (value instanceof Map) {
    return Array.from(value.entries());
  }
  return Object.entries(value);
}

function encodeMapEntries(entries) {
  const prepared = entries.map(([key, value]) => ({
    keyBytes: cborEncode(key),
    valueBytes: cborEncode(value)
  }));
  prepared.sort((left, right) => compareBytes(left.keyBytes, right.keyBytes));
  const body = prepared.flatMap((entry) => [entry.keyBytes, entry.valueBytes]);
  return concatBytes([encodeMajorType(5, prepared.length), ...body]);
}

export function cborEncode(value) {
  if (value === null) {
    return Uint8Array.of(0xf6);
  }
  if (typeof value === 'boolean') {
    return Uint8Array.of(value ? 0xf5 : 0xf4);
  }
  if (typeof value === 'number') {
    return encodeInteger(value);
  }
  if (typeof value === 'string') {
    return encodeString(value);
  }
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return encodeBytes(value);
  }
  if (Array.isArray(value)) {
    const parts = value.map((item) => cborEncode(item));
    return concatBytes([encodeMajorType(4, value.length), ...parts]);
  }
  if (value instanceof Map || isPlainObject(value)) {
    return encodeMapEntries(normalizeMapEntries(value));
  }
  throw new TypeError(`unsupported CBOR type: ${typeof value}`);
}

function readLength(bytes, offset, additionalInfo) {
  if (additionalInfo < 24) {
    return { value: additionalInfo, nextOffset: offset };
  }
  if (additionalInfo === 24) {
    return { value: bytes[offset], nextOffset: offset + 1 };
  }
  if (additionalInfo === 25) {
    return {
      value: (bytes[offset] << 8) | bytes[offset + 1],
      nextOffset: offset + 2
    };
  }
  if (additionalInfo === 26) {
    return {
      value:
        (bytes[offset] * 0x1000000) +
        ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]),
      nextOffset: offset + 4
    };
  }
  if (additionalInfo === 27) {
    const high =
      (bytes[offset] * 0x1000000) +
      ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]);
    const low =
      (bytes[offset + 4] * 0x1000000) +
      ((bytes[offset + 5] << 16) | (bytes[offset + 6] << 8) | bytes[offset + 7]);
    const value = high * 0x100000000 + low;
    if (!Number.isSafeInteger(value)) {
      throw new Error('CBOR length exceeds safe integer range');
    }
    return { value, nextOffset: offset + 8 };
  }
  throw new Error('indefinite length CBOR is not supported');
}

function decodeMap(entries) {
  const allStringKeys = entries.every(([key]) => typeof key === 'string');
  if (allStringKeys) {
    const output = {};
    for (const [key, value] of entries) {
      output[key] = value;
    }
    return output;
  }
  return new Map(entries);
}

function decodeItem(bytes, startOffset) {
  const initial = bytes[startOffset];
  const majorType = initial >> 5;
  const additionalInfo = initial & 0x1f;
  let offset = startOffset + 1;

  if (majorType === 0 || majorType === 1) {
    const meta = readLength(bytes, offset, additionalInfo);
    const value = majorType === 0 ? meta.value : -1 - meta.value;
    return { value, nextOffset: meta.nextOffset };
  }

  if (majorType === 2 || majorType === 3) {
    const meta = readLength(bytes, offset, additionalInfo);
    const body = bytes.slice(meta.nextOffset, meta.nextOffset + meta.value);
    const value = majorType === 2 ? body : utf8Decode(body);
    return { value, nextOffset: meta.nextOffset + meta.value };
  }

  if (majorType === 4) {
    const meta = readLength(bytes, offset, additionalInfo);
    const values = [];
    offset = meta.nextOffset;
    for (let index = 0; index < meta.value; index += 1) {
      const item = decodeItem(bytes, offset);
      values.push(item.value);
      offset = item.nextOffset;
    }
    return { value: values, nextOffset: offset };
  }

  if (majorType === 5) {
    const meta = readLength(bytes, offset, additionalInfo);
    const entries = [];
    offset = meta.nextOffset;
    for (let index = 0; index < meta.value; index += 1) {
      const key = decodeItem(bytes, offset);
      const value = decodeItem(bytes, key.nextOffset);
      entries.push([key.value, value.value]);
      offset = value.nextOffset;
    }
    return { value: decodeMap(entries), nextOffset: offset };
  }

  if (majorType === 7) {
    if (additionalInfo === 20) {
      return { value: false, nextOffset: offset };
    }
    if (additionalInfo === 21) {
      return { value: true, nextOffset: offset };
    }
    if (additionalInfo === 22) {
      return { value: null, nextOffset: offset };
    }
  }

  throw new Error(`unsupported CBOR item: major=${majorType} ai=${additionalInfo}`);
}

export function cborDecode(value) {
  const bytes = toUint8Array(value);
  const decoded = decodeItem(bytes, 0);
  if (decoded.nextOffset !== bytes.length) {
    throw new Error('trailing CBOR bytes');
  }
  return decoded.value;
}
