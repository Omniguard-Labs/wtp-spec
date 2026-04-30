import * as ethers from 'ethers';

function normalizeHexString(value) {
  const normalized = String(value).toLowerCase();
  if (!ethers.isHexString(normalized)) {
    throw new TypeError(`invalid hex string: ${value}`);
  }
  if (normalized === '0x') {
    return normalized;
  }
  const body = normalized.slice(2);
  return `0x${body.length % 2 ? `0${body}` : body}`;
}

export const utils = {
  AbiCoder: ethers.AbiCoder,
  Interface: ethers.Interface,
  id: ethers.id,
  getAddress: ethers.getAddress,
  isHexString: ethers.isHexString,
  hexlify(value) {
    if (typeof value === 'string') {
      return normalizeHexString(value);
    }
    return ethers.hexlify(value);
  },
  hexZeroPad(value, length) {
    const bytesLike = typeof value === 'string' ? normalizeHexString(value) : value;
    return ethers.zeroPadValue(bytesLike, length);
  },
  hexConcat(values) {
    return ethers.concat(values);
  },
  hexDataSlice(value, start, end) {
    return ethers.dataSlice(value, start, end);
  },
  arrayify(value) {
    return ethers.getBytes(typeof value === 'string' ? normalizeHexString(value) : value);
  },
  keccak256: ethers.keccak256,
  hashMessage(value) {
    const bytes = typeof value === 'string' ? ethers.getBytes(normalizeHexString(value)) : value;
    return ethers.hashMessage(bytes);
  },
  computeAddress: ethers.computeAddress,
  recoverAddress(digest, signature) {
    const normalizedSignature =
      signature && signature.recoveryParam !== undefined
        ? { ...signature, yParity: signature.recoveryParam }
        : signature;
    return ethers.recoverAddress(digest, normalizedSignature);
  },
  RLP: {
    encode: ethers.encodeRlp,
    decode: ethers.decodeRlp
  },
  SigningKey: class {
    constructor(privateKey) {
      this.signingKey = new ethers.SigningKey(privateKey);
    }

    signDigest(digest) {
      const signature = this.signingKey.sign(digest);
      return {
        r: signature.r,
        s: signature.s,
        yParity: signature.yParity,
        recoveryParam: signature.yParity,
        v: signature.v
      };
    }
  }
};
