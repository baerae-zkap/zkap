import { base64URLencode, base64URLdecode } from "../utils/base64url";
import { IUserOpSigner } from "../utils/IUserOpSigner";
import {
  unwrapSignature,
  flipSecp256r1Signature,
  wrapSignature,
} from "../utils/signature";
import { ethers } from "ethers";
import cryptoUtils from "../utils/crypto";
import { PrimitiveAccountKeyTypes } from "../types/AccountKey";

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
    const signedMessage = cryptoUtils.getSignedMessageHash(userOpHash);
    const challenge = base64URLencode(signedMessage);
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
    const clientJsonStr = new TextDecoder().decode(clientJsonBytes);

    const typeKey = '"type":"';
    const typeKeyOffset = clientJsonStr.indexOf(typeKey);
    if (typeKeyOffset < 0) throw new Error('signUserOpHash: clientDataJSON missing "type" field');
    const typeIndex = typeKeyOffset + typeKey.length;

    const challengeKey = '"challenge":"';
    const challengeKeyOffset = clientJsonStr.indexOf(challengeKey);
    if (challengeKeyOffset < 0) throw new Error('signUserOpHash: clientDataJSON missing "challenge" field');
    const challengeIndex = challengeKeyOffset + challengeKey.length;

    const originKey = '"origin":"';
    const originKeyOffset = clientJsonStr.indexOf(originKey);
    if (originKeyOffset < 0) throw new Error('signUserOpHash: clientDataJSON missing "origin" field');
    const originIndex = originKeyOffset + originKey.length;
    const originEnd = clientJsonStr.indexOf('"', originIndex);
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
