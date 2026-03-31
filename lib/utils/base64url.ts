import { ethers } from 'ethers';

/**
 * Decodes a Base64URL string to Uint8Array.
 * @note Depends on Node.js Buffer; a polyfill is required in browser environments.
 *       For browser compatibility, replace with an implementation using atob() and Uint8Array.
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
