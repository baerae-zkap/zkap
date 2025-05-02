import { ethers } from 'ethers';

export function base64URLdecode(str: string): string {
  const base64Encoded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const base64WithPadding = base64Encoded + padding;
  return atob(base64WithPadding)
    .split('')
    .map((char) => String.fromCharCode(char.charCodeAt(0)))
    .join('');
}

export function base64URLencode(str: string): string {
  const base64Encoded = ethers.encodeBase64(ethers.toUtf8Bytes(str));
  return base64Encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function toURLEncode(base64str: string): string {
  return base64str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function StringToUint8Array(str: string): Uint8Array {
  let r = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    r[i] = str.charCodeAt(i);
  }

  return r;
}

export function Uint8ArrayToString(uint8Array: Uint8Array): string {
  let string = '';
  uint8Array.forEach((byte) => (string = string + String.fromCharCode(byte)));
  return string;
}
