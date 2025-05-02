import { base64URLencode } from "../utils/base64url";
import { IUserOpSigner } from "../utils/IUserOpSigner";
import { StringToUint8Array, base64URLdecode } from "../utils/base64url";
import {
  unwrapSignature,
  flipSecp256r1Signature,
  wrapSignature,
} from "../utils/signature";
import { ethers } from "ethers";
import cryptoUtils from "../utils/crypto";

export class PasskeySigner implements IUserOpSigner {
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
    try {
      const signedMessage = cryptoUtils.getSignedMessageHash(userOpHash);
      const challenge = base64URLencode(signedMessage);
      const authResp = await this.verifyWithPasskey(
        this.credentialId,
        challenge
      );

      let [r, s] = unwrapSignature(
        StringToUint8Array(base64URLdecode(authResp.response.signature))
      );
      let [newR, newS] = flipSecp256r1Signature(r, s);
      let newSig = wrapSignature(newR, newS);

      let abiCoder = ethers.AbiCoder.defaultAbiCoder();
      let encodedSignature = abiCoder.encode(
        ["bytes", "bytes", "bytes"],
        [
          ethers.hexlify(
            StringToUint8Array(
              base64URLdecode(authResp.response.authenticatorData)
            )
          ),
          ethers.hexlify(
            StringToUint8Array(
              base64URLdecode(authResp.response.clientDataJSON)
            )
          ),
          ethers.hexlify(newSig),
        ]
      );

      return [encodedSignature];
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
}
