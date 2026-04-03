import { ethers } from 'ethers';

/**
 * Decodes a Base64URL string to Uint8Array.
 *
 * Converts URL-safe characters (`-` → `+`, `_` → `/`) and restores
 * standard Base64 padding before decoding.
 *
 * @note Depends on Node.js `Buffer`; a polyfill is required in browser
 *       environments. For browser compatibility, replace with an
 *       implementation using `atob()` and `Uint8Array`.
 *
 * @param str - Base64URL-encoded string to decode.
 * @returns Decoded bytes as a `Uint8Array`.
 *
 * @example
 * const bytes = base64URLdecode("SGVsbG8gV29ybGQ");
 * // Uint8Array [ 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100 ]
 */
export function base64URLdecode(str: string): Uint8Array {
  const base64Encoded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const base64WithPadding = base64Encoded + padding;
  const buf = Buffer.from(base64WithPadding, "base64");
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

/**
 * Encodes a UTF-8 string to Base64URL format.
 *
 * Converts the string to UTF-8 bytes, Base64-encodes them via ethers.js,
 * then replaces standard Base64 characters with their URL-safe equivalents
 * and strips trailing padding.
 *
 * @param str - Plain UTF-8 string to encode.
 * @returns Base64URL-encoded string (no padding, URL-safe characters).
 *
 * @example
 * const encoded = base64URLencode("Hello World");
 * // "SGVsbG8gV29ybGQ"
 */
export function base64URLencode(str: string): string {
  const base64Encoded = ethers.encodeBase64(ethers.toUtf8Bytes(str));
  return base64Encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Converts a standard Base64 string to Base64URL format.
 *
 * Replaces `+` with `-`, `/` with `_`, and removes trailing `=` padding
 * without re-encoding the underlying bytes.
 *
 * @param base64str - Standard Base64-encoded string (may contain `+`, `/`, `=`).
 * @returns Equivalent Base64URL string (no padding, URL-safe characters).
 *
 * @example
 * const urlSafe = toURLEncode("SGVsbG8+V29y/GQ=");
 * // "SGVsbG8-V29y_GQ"
 */
export function toURLEncode(base64str: string): string {
  return base64str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Encodes a UTF-8 string to a `Uint8Array` using the platform's
 * `TextEncoder`.
 *
 * @param str - Plain UTF-8 string to convert.
 * @returns UTF-8 byte representation of the string.
 *
 * @example
 * const bytes = StringToUint8Array("hello");
 * // Uint8Array [ 104, 101, 108, 108, 111 ]
 */
export function StringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Decodes a `Uint8Array` of UTF-8 bytes back to a plain string using the
 * platform's `TextDecoder`.
 *
 * @param uint8Array - UTF-8 encoded byte array to decode.
 * @returns Decoded UTF-8 string.
 *
 * @example
 * const str = Uint8ArrayToString(new Uint8Array([104, 101, 108, 108, 111]));
 * // "hello"
 */
export function Uint8ArrayToString(uint8Array: Uint8Array): string {
  return new TextDecoder().decode(uint8Array);
}
