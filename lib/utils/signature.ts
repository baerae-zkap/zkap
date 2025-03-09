import { ethers } from "ethers";

export function unwrapSignature(sigBuffer: Uint8Array) {
  let rLength = sigBuffer[3];
  let rStart = 4 + rLength - 32;
  let rEnd = rStart + 32;
  let sLength = sigBuffer[rEnd + 1];
  let sStart = rEnd + 2 + sLength - 32;
  let sEnd = sStart + 32;
  let r = sigBuffer.slice(rStart, rEnd);
  let s = sigBuffer.slice(sStart, sEnd);

  return [r, s];
}

export function flipSecp256r1Signature(
  r: Uint8Array,
  s: Uint8Array
): Uint8Array[] {
  let bigS = ethers.toBigInt(s);
  let halfN = ethers.toBigInt(
    fromHex("7fffffff800000007fffffffffffffffde737d56d38bcf4279dce5617e3192a8")
  );
  let N = ethers.toBigInt(
    fromHex("FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551")
  );
  // console.log("halfN", halfN.toString())
  if (bigS > halfN) {
    // console.log("flipping s")
    bigS = N - bigS;
    // console.log("flipped s", bigS.toString())
    s = Buffer.from(ethers.toBeArray(bigS));
  }
  return [r, s];
}

export function wrapSignature(r: Uint8Array, s: Uint8Array): Uint8Array {
  return Buffer.concat([
    new Uint8Array([0x30, 0x44, 0x02, 0x20]),
    r,
    new Uint8Array([0x02, 0x20]),
    s,
  ]);
}

/**
 * Convert a Uint8Array to Hexadecimal.
 *
 * A replacement for `Buffer.toString('hex')`
 */
export function toHex(array: Uint8Array) {
  const hexParts = Array.from(array, (i) => i.toString(16).padStart(2, "0"));
  // adce000235bcc60a648b0b25f1f05503
  return hexParts.join("");
}
/**
 * Convert a hexadecimal string to isoUint8Array.
 *
 * A replacement for `Buffer.from('...', 'hex')`
 */
export function fromHex(hex: string | null) {
  if (!hex) {
    return Uint8Array.from([]);
  }
  const isValid =
    hex.length !== 0 && hex.length % 2 === 0 && !/[^a-fA-F0-9]/u.test(hex);
  if (!isValid) {
    throw new Error("Invalid hex string");
  }
  const byteStrings = hex.match(/.{1,2}/g) ?? [];
  return Uint8Array.from(byteStrings.map((byte) => parseInt(byte, 16)));
}
