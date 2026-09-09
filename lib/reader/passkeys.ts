import { AaOperationError, AaOperationErrorCode } from "../errors";
import {
  normalizeBytes32,
  originHashOf,
  rpIdHashOf,
  toCosePublicKey,
  toJwkPublicKey,
} from "../utils/webauthnKey";
import type { EcP256Jwk } from "../utils/webauthnKey";
import type { ReadVia, TxKeyInfo, TxKeySlots, WebAuthnKeyData } from "./types";

/**
 * The calling service, for the strict "is this MY service's passkey" test.
 *
 * A key counts as the service's only when BOTH its rpIdHash equals
 * `sha256(rpId)` AND its originHash equals `keccak256(origin)` for one of
 * `origins`. The same app registers under a different origin per platform
 * (web `https://<rpId>`, Android `android:apk-key-hash:…`), so list every
 * origin the service signs from.
 */
export interface PasskeyServiceIdentity {
  rpId: string;
  origins: string | string[];
}

export interface GetPasskeysOptions {
  /** Identify "my service" — see {@link PasskeyServiceIdentity}. */
  service?: PasskeyServiceIdentity;
  /**
   * This device's passkey id (base64url, exactly as stored and as passed to
   * `PasskeySigner`). Marks the matching key `isMine` and exposes it as `mine`.
   */
  credentialId?: string;
  /** Other services' rpIds you recognise — used to label foreign keys with `rpId`. */
  knownRpIds?: string[];
  /** Other services' origins you recognise — used to label foreign keys with `origin`. */
  knownOrigins?: string[];
}

/** A P-256 public key in every format an app or web client commonly needs. */
export interface PasskeyPublicKey {
  /** `0x`-prefixed, lowercase, 32 bytes. */
  x: string;
  /** `0x`-prefixed, lowercase, 32 bytes. */
  y: string;
  /** COSE_Key (ES256) bytes as hex — what WebAuthn registration returns as `credentialPublicKey`. */
  cose: string;
  /** JSON Web Key, ready for `crypto.subtle.importKey("jwk", …)`. */
  jwk: EcP256Jwk;
}

/** One WebAuthn txKey, decoded and classified. */
export interface PasskeyKey {
  /** Slot in `txKeyList` — pass to `ZkapBuilder.setSignature([index], …)`. */
  index: number;
  keyId: number;
  logicContract: string;
  /** Credential id as registered (base64url). */
  credentialId: string;
  publicKey: PasskeyPublicKey;
  /** `0x`-prefixed, lowercase, 32 bytes. */
  rpIdHash: string;
  /** `0x`-prefixed, lowercase, 32 bytes. */
  originHash: string;
  /** Resolved rpId — `service.rpId` when it matches, else a `knownRpIds` hit. */
  rpId?: string;
  /** Resolved origin — the matching `service.origins` entry, else a `knownOrigins` hit. */
  origin?: string;
  /** `undefined` when no `service` was given. */
  rpIdMatches?: boolean;
  /** `undefined` when no `service` was given; `true` if ANY listed origin matches. */
  originMatches?: boolean;
  /** `rpIdMatches && originMatches`; `false` when no `service` was given. */
  isMyService: boolean;
  /** `credentialId === options.credentialId`; `false` when none was given. */
  isMine: boolean;
}

export interface PasskeysResult {
  /** `false` — the account is still counterfactual; nothing else is populated. */
  deployed: boolean;
  /** `true` — there may be keys beyond the read window; do not conclude "no other keys". */
  truncated: boolean;
  /** `"direct"` on a chain that has Multicall3 means the transport misbehaved. */
  readVia: ReadVia;
  /** Every txKey, WebAuthn or not (`= txKeys.length`). */
  total: number;
  /** Raw slots — hand these to `TxKeyHelper` without another read. */
  txKeys: TxKeyInfo[];
  /** WebAuthn slots whose key data could be read. */
  passkeys: PasskeyKey[];
  /**
   * Slot indexes detected as WebAuthn whose `getKeyData` failed. Non-empty
   * means this result is degraded — do not conclude "not registered".
   */
  unreadable: number[];
  /** rpId AND origin match `service`. Empty without `service`. */
  myService: PasskeyKey[];
  /** rpId matches but origin does not — e.g. the same app on a platform not listed in `origins`. */
  sameRpIdOtherOrigin: PasskeyKey[];
  /** rpId does not match `service`. */
  otherServices: PasskeyKey[];
  /** The first key whose credentialId equals `options.credentialId`. */
  mine?: PasskeyKey;
}

/** {@link GetPasskeysOptions} after validation, with hashes precomputed. */
export interface NormalizedPasskeyOptions {
  service?: { rpId: string; rpIdHash: string; origins: { origin: string; hash: string }[] };
  credentialId?: string;
  knownRpIds: { rpId: string; hash: string }[];
  knownOrigins: { origin: string; hash: string }[];
}

const OPERATION = "get_passkeys";

function invalid(message: string): AaOperationError {
  return new AaOperationError({
    code: AaOperationErrorCode.INPUT_INVALID,
    operation: OPERATION,
    message: `AccountReader.getPasskeys: ${message}`,
  });
}

/**
 * Validate {@link GetPasskeysOptions} and precompute every hash once. Throws
 * `AaOperationError` (`INPUT_INVALID`) for an empty rpId / origin /
 * credentialId, so the reader can reject bad options before touching the chain.
 */
export function normalizeOptions(opts: GetPasskeysOptions = {}): NormalizedPasskeyOptions {
  const knownRpIds = (opts.knownRpIds ?? []).map((rpId) => {
    if (!rpId) throw invalid("knownRpIds must not contain an empty string");
    return { rpId, hash: rpIdHashOf(rpId) };
  });
  const knownOrigins = (opts.knownOrigins ?? []).map((origin) => {
    if (!origin) throw invalid("knownOrigins must not contain an empty string");
    return { origin, hash: originHashOf(origin) };
  });

  let service: NormalizedPasskeyOptions["service"];
  if (opts.service !== undefined) {
    const { rpId, origins } = opts.service;
    if (!rpId) throw invalid("service.rpId must be a non-empty string");
    const list = typeof origins === "string" ? [origins] : origins;
    if (list.length === 0) throw invalid("service.origins must list at least one origin");
    service = {
      rpId,
      rpIdHash: rpIdHashOf(rpId),
      origins: list.map((origin) => {
        if (!origin) throw invalid("service.origins must not contain an empty string");
        return { origin, hash: originHashOf(origin) };
      }),
    };
  }

  if (opts.credentialId === "") throw invalid("credentialId must be a non-empty string when given");

  return { service, credentialId: opts.credentialId, knownRpIds, knownOrigins };
}

function classify(key: TxKeyInfo, data: WebAuthnKeyData, n: NormalizedPasskeyOptions): PasskeyKey {
  const x = normalizeBytes32(data.x);
  const y = normalizeBytes32(data.y);
  const rpIdHash = normalizeBytes32(data.allowedRpIdHash);
  const originHash = normalizeBytes32(data.allowedOriginHash);

  const out: PasskeyKey = {
    index: key.index,
    keyId: key.keyId,
    logicContract: key.logicContract,
    credentialId: data.credentialId,
    publicKey: { x, y, cose: toCosePublicKey({ x, y }), jwk: toJwkPublicKey({ x, y }) },
    rpIdHash,
    originHash,
    isMyService: false,
    isMine: n.credentialId !== undefined && data.credentialId === n.credentialId,
  };

  if (n.service) {
    const rpIdMatches = rpIdHash === n.service.rpIdHash;
    const originHit = n.service.origins.find((o) => o.hash === originHash);
    out.rpIdMatches = rpIdMatches;
    out.originMatches = originHit !== undefined;
    out.isMyService = rpIdMatches && originHit !== undefined;
    if (rpIdMatches) out.rpId = n.service.rpId;
    if (originHit) out.origin = originHit.origin;
  }
  if (out.rpId === undefined) {
    const hit = n.knownRpIds.find((k) => k.hash === rpIdHash);
    if (hit) out.rpId = hit.rpId;
  }
  if (out.origin === undefined) {
    const hit = n.knownOrigins.find((k) => k.hash === originHash);
    if (hit) out.origin = hit.origin;
  }
  return out;
}

/**
 * Turn raw txKey slots into a classified {@link PasskeysResult}. Pure — no
 * transport — so it can be unit-tested and reused on slots read elsewhere.
 * Validates `opts` (see {@link normalizeOptions}).
 */
export function buildPasskeysResult(slots: TxKeySlots, opts?: GetPasskeysOptions): PasskeysResult {
  const n = normalizeOptions(opts);

  const passkeys: PasskeyKey[] = [];
  const unreadable: number[] = [];
  for (const key of slots.keys) {
    if (key.keyType !== "webauthn") continue;
    if (!key.webauthn) {
      unreadable.push(key.index);
      continue;
    }
    passkeys.push(classify(key, key.webauthn, n));
  }

  const result: PasskeysResult = {
    deployed: slots.deployed,
    truncated: slots.truncated,
    readVia: slots.readVia,
    total: slots.keys.length,
    txKeys: slots.keys,
    passkeys,
    unreadable,
    myService: n.service ? passkeys.filter((k) => k.isMyService) : [],
    sameRpIdOtherOrigin: n.service
      ? passkeys.filter((k) => k.rpIdMatches === true && k.originMatches === false)
      : [],
    otherServices: n.service ? passkeys.filter((k) => k.rpIdMatches === false) : [],
  };
  const mine = passkeys.find((k) => k.isMine);
  if (mine) result.mine = mine;
  return result;
}
