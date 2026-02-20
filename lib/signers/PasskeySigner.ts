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

    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const encodedSignature = abiCoder.encode(
      ["bytes", "bytes", "bytes"],
      [
        ethers.hexlify(
          base64URLdecode(authResp.response.authenticatorData)
        ),
        ethers.hexlify(
          base64URLdecode(authResp.response.clientDataJSON)
        ),
        ethers.hexlify(newSig),
      ]
    );

    return [encodedSignature];
  }
}
