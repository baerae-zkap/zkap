import { base64URLdecode, toURLEncode } from "../utils/base64url";
import { IUserOpSigner } from "../utils/IUserOpSigner";
import {
  unwrapSignature,
  flipSecp256r1Signature,
  wrapSignature,
} from "../utils/signature";
import { ethers } from "ethers";
import { PrimitiveAccountKeyTypes } from "../types/AccountKey";

function findSubarray(haystack: Uint8Array, needle: Uint8Array): number {
  if (needle.length === 0 || haystack.length < needle.length) return -1;
  const maxStart = haystack.length - needle.length;
  for (let i = 0; i <= maxStart; i++) {
    let matched = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        matched = false;
        break;
      }
    }
    if (matched) return i;
  }
  return -1;
}

function findByte(bytes: Uint8Array, value: number, fromIndex: number): number {
  for (let i = fromIndex; i < bytes.length; i++) {
    if (bytes[i] === value) return i;
  }
  return -1;
}

export class PasskeySigner implements IUserOpSigner {
  public readonly keyTypes: number[] = [PrimitiveAccountKeyTypes.keyWebAuthn];
  private credentialId: string;
  private verifyWithPasskey: (
    credentialId: string,
    challenge: string
  ) => Promise<{
    response: {
      signature: string;
      authenticatorData: string;
      clientDataJSON: string;
    };
  }>;
  constructor(
    credentialId: string,
    verifyWithPasskey: (
      credentialId: string,
      challenge: string
    ) => Promise<{
      response: {
        signature: string;
        authenticatorData: string;
        clientDataJSON: string;
      };
    }>
  ) {
    this.credentialId = credentialId;
    this.verifyWithPasskey = verifyWithPasskey;
  }

  async signUserOpHash(userOpHash: string): Promise<string[]> {
    // raw 32 bytes → base64URL (컨트랙트의 Base64.encodeURL(abi.encodePacked(bytes32(msgHash)))와 일치)
    const challenge = toURLEncode(ethers.encodeBase64(ethers.getBytes(userOpHash)));
    const authResp = await this.verifyWithPasskey(
      this.credentialId,
      challenge
    );

    const [r, s] = unwrapSignature(
      base64URLdecode(authResp.response.signature)
    );
    const [newR, newS] = flipSecp256r1Signature(r, s);
    const newSig = wrapSignature(newR, newS);

    const clientJsonBytes = base64URLdecode(authResp.response.clientDataJSON);
    const encoder = new TextEncoder();

    const typeKey = encoder.encode('"type":"');
    const typeKeyOffset = findSubarray(clientJsonBytes, typeKey);
    if (typeKeyOffset < 0) throw new Error('signUserOpHash: clientDataJSON missing "type" field');
    const typeIndex = typeKeyOffset + typeKey.byteLength;

    const challengeKey = encoder.encode('"challenge":"');
    const challengeKeyOffset = findSubarray(clientJsonBytes, challengeKey);
    if (challengeKeyOffset < 0) throw new Error('signUserOpHash: clientDataJSON missing "challenge" field');
    const challengeIndex = challengeKeyOffset + challengeKey.byteLength;

    const originKey = encoder.encode('"origin":"');
    const originKeyOffset = findSubarray(clientJsonBytes, originKey);
    if (originKeyOffset < 0) throw new Error('signUserOpHash: clientDataJSON missing "origin" field');
    const originIndex = originKeyOffset + originKey.byteLength;
    const originEnd = findByte(clientJsonBytes, 0x22, originIndex); // 0x22 = '"'
    if (originEnd < 0) throw new Error('signUserOpHash: clientDataJSON "origin" value not terminated');
    const originLength = originEnd - originIndex;

    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const encodedSignature = abiCoder.encode(
      ["bytes", "bytes", "bytes", "uint256", "uint256", "uint256", "uint256"],
      [
        ethers.hexlify(base64URLdecode(authResp.response.authenticatorData)),
        ethers.hexlify(clientJsonBytes),
        ethers.hexlify(newSig),
        typeIndex,
        challengeIndex,
        originIndex,
        originLength,
      ]
    );

    return [encodedSignature];
  }
}
