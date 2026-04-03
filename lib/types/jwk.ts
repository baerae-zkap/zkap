/**
 * A single JSON Web Key (JWK) entry as returned by an OAuth provider's
 * JWKS endpoint (e.g. `https://www.googleapis.com/oauth2/v3/certs`).
 *
 * The SDK uses these fields to locate and reconstruct the RSA public key
 * that verifies a user's ID token.
 *
 * @see {@link https://www.rfc-editor.org/rfc/rfc7517 RFC 7517 — JSON Web Key}
 *
 * @example
 * const key: JwkKey = {
 *   kid: "1e9gdk7",
 *   alg: "RS256",
 *   kty: "RSA",
 *   use: "sig",
 *   n: "pjdss8ZaDf...",   // Base64URL-encoded RSA modulus
 *   e: "AQAB",            // Base64URL-encoded public exponent
 * };
 */
export interface JwkKey {
  /** Key identifier matching the `kid` header of the signed JWT. */
  kid: string;
  /** Algorithm for which the key is intended, e.g. `"RS256"`. */
  alg: string;
  /** Key type; always `"RSA"` for RS256 tokens. */
  kty: string;
  /** Intended use of the key; `"sig"` indicates a signing key. */
  use: string;
  /** Base64URL-encoded RSA modulus (`n` parameter of the RSA public key). */
  n: string;
  /** Base64URL-encoded RSA public exponent (`e` parameter, typically `"AQAB"`). */
  e: string;
}

/**
 * Decoded header of a JSON Web Token (JWT).
 *
 * The SDK reads these fields to identify which JWK to use for signature
 * verification.
 *
 * @see {@link https://www.rfc-editor.org/rfc/rfc7515 RFC 7515 — JSON Web Signature}
 *
 * @example
 * const header: JwtHeader = {
 *   alg: "RS256",
 *   kid: "1e9gdk7",
 *   typ: "JWT",
 * };
 */
export interface JwtHeader {
  /** Signing algorithm declared by the token issuer, e.g. `"RS256"`. */
  alg: string;
  /** Key identifier used to look up the matching {@link JwkKey} from JWKS. */
  kid: string;
  /** Token type; typically `"JWT"` when present. */
  typ?: string;
}
