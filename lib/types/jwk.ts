export interface JwkKey {
  kid: string;
  alg: string;
  kty: string;
  use: string;
  n: string;
  e: string;
}

export interface JwtHeader {
  alg: string;
  kid: string;
  typ?: string;
}
