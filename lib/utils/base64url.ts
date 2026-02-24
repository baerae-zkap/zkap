import { ethers } from 'ethers';

/**
 * Base64URL 문자열을 Uint8Array로 디코딩합니다.
 * @note Node.js Buffer에 의존하므로 브라우저 환경에서는 폴리필이 필요합니다.
 *       브라우저 호환이 필요한 경우 atob()와 Uint8Array를 사용하는 방식으로 교체하세요.
 */
export function base64URLdecode(str: string): Uint8Array {
  const base64Encoded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const base64WithPadding = base64Encoded + padding;
  const buf = Buffer.from(base64WithPadding, "base64");
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

export function base64URLencode(str: string): string {
  const base64Encoded = ethers.encodeBase64(ethers.toUtf8Bytes(str));
  return base64Encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function toURLEncode(base64str: string): string {
  return base64str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function StringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

export function Uint8ArrayToString(uint8Array: Uint8Array): string {
  return new TextDecoder().decode(uint8Array);
}
