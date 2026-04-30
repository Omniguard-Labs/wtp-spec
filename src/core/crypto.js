import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';

function toBuffer(value) {
  if (Buffer.isBuffer(value)) {
    return value;
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }
  if (typeof value === 'string') {
    return Buffer.from(value, 'utf8');
  }
  throw new TypeError('expected Buffer, Uint8Array, or string');
}

function createPublicKeyObject(key) {
  if (typeof key === 'string') {
    return crypto.createPublicKey(key);
  }
  if (Buffer.isBuffer(key) || key instanceof Uint8Array) {
    return crypto.createPublicKey({
      key: Buffer.from(key),
      format: 'der',
      type: 'spki'
    });
  }
  return key;
}

function createPrivateKeyObject(key) {
  if (typeof key === 'string') {
    return crypto.createPrivateKey(key);
  }
  return key;
}

export function generateEd25519KeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicKeyDer = publicKey.export({ format: 'der', type: 'spki' });
  return {
    publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }),
    publicKeyDer: new Uint8Array(publicKeyDer),
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' })
  };
}

export function fingerprintPublicKey(key) {
  const publicKey = createPublicKeyObject(key);
  const der = publicKey.export({ format: 'der', type: 'spki' });
  const digest = crypto.createHash('sha256').update(der).digest('hex');
  return `sha256:${digest}`;
}

export function signEd25519(message, privateKey) {
  return new Uint8Array(
    crypto.sign(null, toBuffer(message), createPrivateKeyObject(privateKey))
  );
}

export function verifyEd25519(message, signature, publicKey) {
  return crypto.verify(
    null,
    toBuffer(message),
    createPublicKeyObject(publicKey),
    toBuffer(signature)
  );
}

export function publicKeyDerToPem(publicKeyDer) {
  return createPublicKeyObject(publicKeyDer).export({ format: 'pem', type: 'spki' });
}

export function publicKeyPemToDer(publicKeyPem) {
  const publicKey = createPublicKeyObject(publicKeyPem);
  return new Uint8Array(publicKey.export({ format: 'der', type: 'spki' }));
}

export function isoNow() {
  return new Date().toISOString();
}

export function addDaysToIsoDate(value, days) {
  const timestamp = new Date(value || Date.now()).getTime();
  if (!Number.isFinite(timestamp)) {
    throw new TypeError('invalid ISO date');
  }
  return new Date(timestamp + Number(days) * 24 * 60 * 60 * 1000).toISOString();
}

export function isIsoDateWithinRange(nowValue, validFrom, validTo) {
  const now = new Date(nowValue || Date.now()).getTime();
  if (!Number.isFinite(now)) {
    return false;
  }
  if (validFrom) {
    const start = new Date(validFrom).getTime();
    if (!Number.isFinite(start) || now < start) {
      return false;
    }
  }
  if (validTo) {
    const end = new Date(validTo).getTime();
    if (!Number.isFinite(end) || now > end) {
      return false;
    }
  }
  return true;
}

export function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

export function base64UrlDecode(value) {
  return new Uint8Array(Buffer.from(String(value || ''), 'base64url'));
}

export function sha256(value) {
  return new Uint8Array(crypto.createHash('sha256').update(toBuffer(value)).digest());
}
