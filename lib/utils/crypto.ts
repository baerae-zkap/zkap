import { ethers } from "ethers";

export const BN254_FR =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const MODULUS_BIT_SIZE = 254;
const LIMB_WIDTH = Math.floor((MODULUS_BIT_SIZE - 1) / 8); // = 31

// NOTE: This is a custom SHA-256 block compression for ZK circuit intermediate state computation, not a general-purpose hash. Cannot be replaced by ethers.sha256.
function sha256BlockCompress(data: Uint8Array): number[] {
  if (data.length % 64 !== 0) {
    throw new Error("data length must be a multiple of 64 bytes");
  }

  // 초기 해시 값으로 시작
  let state = INITIAL_HASH_VALUE;

  // 64바이트 단위로 데이터를 순회하면서 상태 업데이트
  for (let i = 0; i < data.length; i += 64) {
    const chunk = data.slice(i, i + 64);
    state = sha256BlockCompressWithState(state, chunk);
  }

  return state;
}

function getOutOfCircuitHashSegment(jwt: string, keys: string[]): string {
  if (keys.length === 0) {
    throw new Error("getOutOfCircuitHashSegment: keys must be a non-empty array");
  }
  const hashBlockSize = 64; // 512 bits

  // JWT를 '.' 구분자로 분리 (header, payload, signature)
  const parts = jwt.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT: must contain header, payload, and signature");
  }
  const [headerB64, payloadB64] = parts;

  // header의 길이에 1을 더한 값이 payOffsetB64
  const payOffsetB64 = headerB64.length + 1;
  // URL-safe Base64 디코딩을 수행하여 payload 문자열 생성
  const payload = base64urlToUtf8(payloadB64);

  const minOffset = Math.min(
    ...keys.map((key) => getValueOffsetFromKey(payload, key))
  );

  const minOffsetB64 = Math.floor(minOffset / 3) * 4;

  // 최종 outOfCircuitHashLen 계산: (payOffsetB64 + minOffsetB64)를 hashBlockSize로 나눈 몫에 hashBlockSize를 곱함
  const outOfCircuitHashLen =
    Math.floor((payOffsetB64 + minOffsetB64) / hashBlockSize) * hashBlockSize;
  return jwt.slice(0, outOfCircuitHashLen);
}

function base64urlToUtf8(base64url: string): string {
  // base64url → base64
  const base64 =
    base64url.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (base64url.length % 4)) % 4);

  // base64 decode → UTF-8 string
  return Buffer.from(base64, "base64").toString("utf8");
}

function Utf8ToUint8Array(utf8: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(utf8);
}

// 32비트 우측 회전 함수
// x를 n비트 오른쪽으로 회전
const rotateRight = (x: number, n: number): number =>
  ((x >>> n) | (x << (32 - n))) >>> 0;

// NOTE: This is a custom SHA-256 block compression for ZK circuit intermediate state computation, not a general-purpose hash. Cannot be replaced by ethers.sha256.
function sha256BlockCompressWithState(state: number[], data: Uint8Array) {
  /* istanbul ignore next */
  if (data.length !== 64) {
    throw new Error("data length must be 64 bytes");
  }

  const w = new Uint32Array(64);

  // 메시지 스케줄 준비: 4바이트씩 읽어 빅엔디안 형식으로 변환
  for (let i = 0; i < 16; i++) {
    const j = i * 4;
    w[i] =
      ((data[j] << 24) |
        (data[j + 1] << 16) |
        (data[j + 2] << 8) |
        data[j + 3]) >>>
      0;
  }

  // 메시지 스케줄 확장
  for (let i = 16; i < 64; i++) {
    const s0 =
      (rotateRight(w[i - 15], 7) ^
        rotateRight(w[i - 15], 18) ^
        (w[i - 15] >>> 3)) >>>
      0;
    const s1 =
      (rotateRight(w[i - 2], 17) ^
        rotateRight(w[i - 2], 19) ^
        (w[i - 2] >>> 10)) >>>
      0;
    w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
  }

  // 작업 변수 초기화
  let [a, b, c, d, e, f, g, h] = state;

  // 압축 함수 메인 루프
  for (let i = 0; i < 64; i++) {
    const s1 =
      (rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)) >>> 0;
    const ch = ((e & f) ^ (~e & g)) >>> 0;
    const temp1 = (h + s1 + ch + K[i] + w[i]) >>> 0;
    const s0 =
      (rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)) >>> 0;
    const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
    const temp2 = (s0 + maj) >>> 0;

    h = g;
    g = f;
    f = e;
    e = (d + temp1) >>> 0;
    d = c;
    c = b;
    b = a;
    a = (temp1 + temp2) >>> 0;
  }

  // 압축 결과를 원래 상태와 더하여 새로운 상태를 계산
  return [
    (state[0] + a) >>> 0,
    (state[1] + b) >>> 0,
    (state[2] + c) >>> 0,
    (state[3] + d) >>> 0,
    (state[4] + e) >>> 0,
    (state[5] + f) >>> 0,
    (state[6] + g) >>> 0,
    (state[7] + h) >>> 0,
  ];
}

function getValueOffsetFromKey(payload: string, key: string): number {
  // key에 해당하는 claim을 찾기 위한 정규식 패턴.
  // 패턴은 "key" 다음에 optional 공백, 콜론, optional 공백, 그리고
  // value를 (큰 따옴표가 있으면 그 따옴표까지 포함하여, 없으면 공백, 콤마, 또는 '}' 전까지) 캡처합니다.
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regexPattern = new RegExp(
    `"${escapedKey}"\\s*:\\s*(?<value>"[^"]*"|[^\\s,\\}]+)`
  );

  const match = regexPattern.exec(payload);
  if (!match) {
    throw new Error(`Claim with key "${key}" not found in payload`);
  }

  // match[0]는 전체 매칭 문자열, match.groups?.value는 named capture group(값)입니다.
  const fullMatch = match[0];
  const valuePart = match.groups?.value;
  if (!valuePart) {
    throw new Error(
      `Value part not found in the matched string for key "${key}"`
    );
  }

  // 전체 매칭 문자열 내에서 valuePart가 시작하는 인덱스를 계산합니다.
  const indexInMatch = fullMatch.indexOf(valuePart);

  // 전체 payload에서의 offset은 매칭 시작 인덱스(match.index)와 valuePart의 내부 인덱스(indexInMatch)의 합입니다.
  return (match.index /* istanbul ignore next */ ?? 0) + indexInMatch;
}

const INITIAL_HASH_VALUE = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
  0x1f83d9ab, 0x5be0cd19,
];

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function commonVkParser(
  commonVk: string[]
): [string[][], string, string, string, string] {
  const g1Generator = [commonVk[0], commonVk[1]];
  const g2Generator = [commonVk[3], commonVk[2], commonVk[5], commonVk[4]];
  const g2X = [commonVk[7], commonVk[6], commonVk[9], commonVk[8]];
  const g1Z = [commonVk[10], commonVk[11]];
  const g2Z = [commonVk[13], commonVk[12], commonVk[15], commonVk[14]];

  const pairingVk = [g1Generator, g2Generator, g2X, g1Z, g2Z];

  const n = commonVk[16];
  const m0 = commonVk[17];
  const sigma = commonVk[18];
  const omega = commonVk[19];

  const verifyingKeyBase: [string[][], string, string, string, string] = [
    pairingVk,
    n,
    m0,
    sigma,
    omega,
  ];
  return verifyingKeyBase;
}

function getSignedMessageHash(message: string): string {
  const signedMessage = ethers.keccak256(
    ethers.concat([
      ethers.toUtf8Bytes("\x19Ethereum Signed Message:\n32"),
      ethers.getBytes(message),
    ])
  );

  return signedMessage;
}

function userSpecificVkParser(userVk: string[] | bigint[]): bigint[][] {
  if (userVk.length !== 16) {
    throw new Error("userVk length must be 16");
  }

  const g2Mu = [
    BigInt(userVk[1].toString()),
    BigInt(userVk[0].toString()),
    BigInt(userVk[3].toString()),
    BigInt(userVk[2].toString()),
  ];

  const g2MuX = [
    BigInt(userVk[5].toString()),
    BigInt(userVk[4].toString()),
    BigInt(userVk[7].toString()),
    BigInt(userVk[6].toString()),
  ];

  const g2MuZ = [
    BigInt(userVk[9].toString()),
    BigInt(userVk[8].toString()),
    BigInt(userVk[11].toString()),
    BigInt(userVk[10].toString()),
  ];

  const vAcc = [
    BigInt(userVk[13].toString()),
    BigInt(userVk[12].toString()),
    BigInt(userVk[15].toString()),
    BigInt(userVk[14].toString()),
  ];

  const userSpecificVk = [g2Mu, g2MuX, g2MuZ, vAcc];

  return userSpecificVk;
}

function userSpecificVkToStringArray(userSpecificVk: bigint[][]): string[] {
  if (userSpecificVk.length !== 4) {
    throw new Error("userSpecificVk must have 4 elements");
  }

  const [g2Mu, g2MuX, g2MuZ, vAcc] = userSpecificVk;

  // 각 배열의 길이가 4인지 확인
  if (
    g2Mu.length !== 4 ||
    g2MuX.length !== 4 ||
    g2MuZ.length !== 4 ||
    vAcc.length !== 4
  ) {
    throw new Error("Each element in userSpecificVk must have 4 elements");
  }

  // 원래 순서대로 재배열
  return [
    g2Mu[1].toString(),
    g2Mu[0].toString(),
    g2Mu[3].toString(),
    g2Mu[2].toString(),
    g2MuX[1].toString(),
    g2MuX[0].toString(),
    g2MuX[3].toString(),
    g2MuX[2].toString(),
    g2MuZ[1].toString(),
    g2MuZ[0].toString(),
    g2MuZ[3].toString(),
    g2MuZ[2].toString(),
    vAcc[1].toString(),
    vAcc[0].toString(),
    vAcc[3].toString(),
    vAcc[2].toString(),
  ];
}

/**
 * Solidity의 formattingModulorN 함수와 동일한 로직을 수행합니다.
 * 바이트 배열을 뒤집고, 8바이트 청크로 나누어 little-endian 방식으로
 * uint256(bigint) 배열로 변환합니다.
 * @param n '0x' 접두사를 포함한 16진수 문자열 또는 Uint8Array
 * @returns bigint[] 타입의 배열
 */
export function formattingModulorN(n: string | Uint8Array): string[] {
  const bytes = ethers.getBytes(n);
  if (bytes.length % 8 !== 0) {
    throw new Error("Input length must be a multiple of 8");
  }

  const reversedBytes = bytes.slice().reverse();

  const chunks = reversedBytes.length / 8;
  const result: string[] = [];

  for (let i = 0; i < chunks; i++) {
    const chunk = reversedBytes.slice(i * 8, (i + 1) * 8);

    let value = 0n;

    for (let j = 0; j < 8; j++) {
      value |= BigInt(chunk[j]) << (8n * BigInt(j));
    }

    result.push(ethers.toBeHex(value));
  }

  return result;
}

/**
 * Rust의 calculate_max_claim_len을 TypeScript로 변환
 * @param userMaxClaimLen 사용자가 요청한 최대 claim 길이
 * @param modulusBitSize   필드의 모듈러스 비트 크기 (기본값: BN254)
 * @returns 필드 limb 단위로 맞춘 max_claim_len
 */
export function calculateMaxClaimLen(
  userMaxClaimLen: number,
  modulusBitSize: number = MODULUS_BIT_SIZE
): number {
  const limbWidth = Math.floor((modulusBitSize - 1) / 8);
  const nLimbs = Math.ceil(userMaxClaimLen / limbWidth);
  const maxClaimLen = nLimbs * limbWidth;
  return maxClaimLen;
}

/**
 * 문자열을 지정된 길이로 패딩
 * @param s 문자열
 * @param targetLen 목표 길이
 * @param padChar 패딩에 사용할 문자 (u8 코드 값)
 * @returns 패딩된 문자열
 */
export function padStr(s: string, targetLen: number, padChar: number): string {
  const len = s.length;

  if (len < targetLen) {
    s += String.fromCharCode(padChar).repeat(targetLen - len);
  }

  return s;
}

/** big-endian bytes -> bigint */
function beBytesToBigInt(bytes: Uint8Array): bigint {
  let x = 0n;
  for (let i = 0; i < bytes.length; i++) x = (x << 8n) + BigInt(bytes[i]);
  return x;
}

/** Rust의 F::from_be_bytes_mod_order와 동일: 31바이트씩 끊어 mod p */
function strToFieldsBN254(s: string): bigint[] {
  const bytes = new TextEncoder().encode(s);

  /* istanbul ignore next */
  if (bytes.length % LIMB_WIDTH !== 0) {
    throw new Error(
      `Input length (${bytes.length}) must be a multiple of ${LIMB_WIDTH}.`
    );
  }

  const out: bigint[] = [];
  for (let i = 0; i < bytes.length; i += LIMB_WIDTH) {
    const chunk = bytes.subarray(i, i + LIMB_WIDTH);
    const n = beBytesToBigInt(chunk) % BN254_FR;
    out.push(n);
  }
  return out;
}

export function padAndStrToFieldsBN254(
  s: string,
  userMaxClaimLen: number,
  padChar: number
): bigint[] {
  const maxClaimLen = calculateMaxClaimLen(userMaxClaimLen);

  s = padStr(s, maxClaimLen, padChar);

  return strToFieldsBN254(s);
}

export default {
  sha256BlockCompress,
  getOutOfCircuitHashSegment,
  Utf8ToUint8Array,
  commonVkParser,
  userSpecificVkParser,
  userSpecificVkToStringArray,
  getSignedMessageHash,
  formattingModulorN,
  padAndStrToFieldsBN254,
};
