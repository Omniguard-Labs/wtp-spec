import { cborDecode, cborEncode } from './cbor.js';
import { signEd25519, verifyEd25519 } from './crypto.js';

const COSE_HEADER_ALG = 1;
const COSE_HEADER_KID = 4;
const COSE_ALG_EDDSA = -8;

function asMap(value) {
  if (value instanceof Map) {
    return value;
  }
  if (value && typeof value === 'object') {
    return new Map(Object.entries(value));
  }
  return new Map();
}

function getMapValue(mapLike, key) {
  if (mapLike instanceof Map) {
    return mapLike.get(key);
  }
  return mapLike?.[key];
}

function buildSigStructure(protectedBytes, payloadBytes) {
  return cborEncode(['Signature1', protectedBytes, new Uint8Array(), payloadBytes]);
}

export function createDetachedCoseSign1({
  payloadBytes,
  privateKeyPem,
  keyId
}) {
  const protectedHeaders = new Map([[COSE_HEADER_ALG, COSE_ALG_EDDSA]]);
  if (keyId) {
    protectedHeaders.set(COSE_HEADER_KID, new TextEncoder().encode(String(keyId)));
  }
  const protectedBytes = cborEncode(protectedHeaders);
  const signature = signEd25519(
    buildSigStructure(protectedBytes, payloadBytes),
    privateKeyPem
  );
  return cborEncode([protectedBytes, new Map(), null, signature]);
}

export function verifyDetachedCoseSign1({
  coseSign1Bytes,
  payloadBytes,
  publicKey
}) {
  const decoded = cborDecode(coseSign1Bytes);
  if (!Array.isArray(decoded) || decoded.length !== 4) {
    return { verified: false, reason: 'invalid_cose_sign1' };
  }
  const [protectedBytes, unprotectedHeaders, payload, signature] = decoded;
  if (!(protectedBytes instanceof Uint8Array) || !(signature instanceof Uint8Array)) {
    return { verified: false, reason: 'invalid_cose_structure' };
  }
  if (payload !== null) {
    return { verified: false, reason: 'expected_detached_payload' };
  }

  const protectedHeaders = asMap(cborDecode(protectedBytes));
  const alg = getMapValue(protectedHeaders, COSE_HEADER_ALG);
  if (alg !== COSE_ALG_EDDSA) {
    return { verified: false, reason: 'unsupported_cose_algorithm' };
  }

  const verified = verifyEd25519(
    buildSigStructure(protectedBytes, payloadBytes),
    signature,
    publicKey
  );
  const kid = getMapValue(protectedHeaders, COSE_HEADER_KID);

  return {
    verified,
    reason: verified ? 'ok' : 'signature_invalid',
    keyId: kid instanceof Uint8Array ? new TextDecoder().decode(kid) : null,
    protectedHeaders,
    unprotectedHeaders
  };
}
