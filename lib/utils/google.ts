import { JwtPayload } from "jwt-decode";
import { jwtDecode } from "jwt-decode";
import { JwkKey, JwtHeader } from "../types/jwk";
import crypto from "crypto";

interface GoogleIdTokenHeader {
  alg: string;
  kid: string;
}
interface GoogleIdTokenPayload extends JwtPayload {
  iss: string;
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  nonce?: string;
  exp: number;
  iat: number;
  aud: string;
}

export function decodeJwtHeader(token: string): GoogleIdTokenHeader {
  const [headerB64] = token.split(".");
  const headerJson = atob(headerB64);
  return JSON.parse(headerJson);
}

// Payload 디코딩
export function decodeJwtPayload(token: string): GoogleIdTokenPayload {
  return jwtDecode<GoogleIdTokenPayload>(token);
}

export function GetJwtHeader(token: string): JwtHeader {
  const parts = token.split(".");
  if (parts.length < 2) throw new Error("Invalid JWT token");
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
  return header as JwtHeader;
}

export async function FetchGoogleOAuthPublicKeys(): Promise<JwkKey[]> {
  try {
    const url = "https://www.googleapis.com/oauth2/v3/certs";
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const keys: JwkKey[] = data.keys;

    return keys;
  } catch (error) {
    console.error("Error fetching Google public keys:", error);
    throw error;
  }
}

export async function GetGoogleOAuthPublicKeyByKid(
  kid: string
): Promise<JwkKey | null> {
  const keys = await FetchGoogleOAuthPublicKeys();
  return keys.find((key) => key.kid === kid) || null;
}

export async function verifyIdTokenSignature(
  idToken: string,
  publicKey?: JwkKey
): Promise<boolean> {
  try {
    // JWT 토큰을 header, payload, signature로 분리
    const [headerB64, payloadB64, signatureB64] = idToken.split(".");

    // 서명 검증을 위한 메시지 생성
    const message = `${headerB64}.${payloadB64}`;

    // Base64Url 디코딩
    const signature = Buffer.from(signatureB64, "base64url");

    if (!publicKey) {
      // header 디코딩
      const header = decodeJwtHeader(idToken);
      // kid 추출
      const kid = header.kid;
      // kid 를 통해 공개키 조회
      const pkFromServer = await GetGoogleOAuthPublicKeyByKid(kid);
      if (!pkFromServer) {
        throw new Error("Public key not found");
      }
      publicKey = pkFromServer;
    }

    // RSA 공개키 생성
    const key = {
      kty: publicKey.kty,
      n: publicKey.n,
      e: publicKey.e,
      alg: publicKey.alg,
      use: publicKey.use,
    };

    // Node.js crypto를 사용하여 키 가져오기
    const verify = crypto.createVerify("RSA-SHA256");
    verify.update(message);

    // 서명 검증
    const isValid = verify.verify(
      {
        key: crypto.createPublicKey({
          key: key,
          format: "jwk",
        }),
        padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      signature
    );

    return isValid;
  } catch (error) {
    console.error("Error verifying ID token signature:", error);
    return false;
  }
}
