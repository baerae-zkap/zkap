import { ethers } from "ethers";
import { IUserOpSigner } from "../utils/IUserOpSigner";
import { BN254_FR } from "../utils/crypto";
import zkapAccountJson from "../types/abi/ZkapAccount.json";
import AccountKeyZkOAuthRS256VerifierJson from "../types/abi/AccountKeyZkOAuthRS256Verifier.json";
import poseidonMerkleTreeDirectoryJson from "../types/abi/PoseidonMerkleTreeDirectory.json";
import { JwkKey, JwtHeader } from "../types/jwk";
import { PrimitiveAccountKeyTypes } from "../types/AccountKey";

const JWKS_CACHE_TTL_MS = 5 * 60 * 1000; // 5분
// NOTE: Module-level cache shared across ZkPasskeySigner instances. Use clearJwksCache() for testing.
// MAX_JWKS_CACHE_SIZE limits memory usage by evicting the oldest entry when exceeded.
const MAX_JWKS_CACHE_SIZE = 50;
const jwksCache = new Map<string, { n: string; cachedAt: number }>();

/**
 * @internal For testing purposes only. Do not use in production code.
 */
export function clearJwksCache(): void {
  jwksCache.clear();
}

function decodeJwtHeader(token: string): JwtHeader {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error(`Invalid JWT format: expected 3 parts, got ${parts.length}`);
  }
  const [headerB64] = parts;
  // JWT uses base64url (- instead of +, _ instead of /, no padding)
  const base64 = headerB64.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const headerJson = Buffer.from(padded, "base64").toString("utf8");
  const header = JSON.parse(headerJson) as JwtHeader;
  if (!header.kid) {
    throw new Error("JWT header missing required field: kid");
  }
  if (header.alg !== "RS256") {
    throw new Error(`Unsupported JWT algorithm: ${header.alg}. Only RS256 is supported.`);
  }
  return header;
}

async function getOAuthPublicKey(jwksUrl: string, kid: string): Promise<string> {
  const cacheKey = `${jwksUrl}#${kid}#RS256#RSA`;
  const cached = jwksCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < JWKS_CACHE_TTL_MS) {
    return cached.n;
  }
  const response = await fetch(jwksUrl);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  if (!data || !Array.isArray(data.keys)) {
    throw new Error("Invalid JWKS response: missing or malformed 'keys' array");
  }
  const keys: JwkKey[] = data.keys;
  const key = keys.find((key) => key.kid === kid && key.kty === "RSA" && key.use === "sig" && key.alg === "RS256");
  if (!key || typeof key.n !== 'string' || key.n.length === 0) {
    throw new Error(`No valid JWK found for kid: ${kid}`);
  }
  // RSA 모듈러스 최소 길이 검증: 2048-bit = 256 bytes ≈ 342 base64url chars
  if (key.n.length < 300) {
    throw new Error(`RSA modulus too short for kid: ${kid}. Minimum 2048-bit key required.`);
  }
  if (typeof key.e !== 'string' || key.e.length === 0) {
    throw new Error(`Missing public exponent (e) for kid: ${kid}`);
  }
  if (jwksCache.size >= MAX_JWKS_CACHE_SIZE) {
    const oldestKey = jwksCache.keys().next().value;
    /* istanbul ignore next */
    if (oldestKey !== undefined) {
      jwksCache.delete(oldestKey);
    }
  }
  const existing = jwksCache.get(cacheKey);
  if (existing && existing.n !== key.n) {
    // 동일 kid로 키가 로테이션된 경우 즉시 업데이트 (stale key 방지)
    console.warn(`[zkap-aa-sdk] JWKS key rotated for cacheKey=${cacheKey}: updating cache`);
  }
  jwksCache.set(cacheKey, { n: key.n, cachedAt: Date.now() });
  return key.n;
}

async function getGoogleOAuthPublicKey(kid: string): Promise<string> {
  return getOAuthPublicKey("https://www.googleapis.com/oauth2/v3/certs", kid);
}

async function getKakaoOAuthPublicKey(kid: string): Promise<string> {
  return getOAuthPublicKey("https://kauth.kakao.com/.well-known/jwks.json", kid);
}

// TODO(post-PR#16): ZkPasskeySigner → ZkOAuthRS256Signer 등 실제 역할에 맞는 클래스명으로 변경 필요.
//                   각 social login provider(Google, Kakao 등)별 서브클래스 분리도 고려.
export class ZkPasskeySigner implements IUserOpSigner {
  public readonly keyTypes: number[] = [PrimitiveAccountKeyTypes.keyZkOAuthRS256];
  private static readonly PROOF_SERVER_TIMEOUT_MS = 30_000;
  private proofServerUrl: string;
  private zkapAddress: string;
  private provider: ethers.JsonRpcProvider;
  private zkapAccount: ethers.Contract | undefined;
  private zkOAuthRS256Verifier: ethers.Contract | undefined;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | undefined;
  private anchor: string[] | undefined;
  private masterKeyId: bigint | undefined;
  private poseidonMerkleTreeDirectory: ethers.Contract | undefined;
  private poseidonMerkleTreeDirectoryAddress: string;
  private socialServices: string[];
  private idTokenGenerators: ((msgHash: string) => Promise<string>)[];
  private selector: boolean[] | undefined;
  private idTokens: string[] | undefined;
  private preparedUserOpHash: string | undefined;
  private _prepareInProgress = false;

  constructor(
    proofServerUrl: string,
    enUrl: string,
    zkapAddress: string,
    socialServices: string[],
    idTokenGenerators: ((msgHash: string) => Promise<string>)[],
    poseidonMerkleTreeDirectoryAddress: string,
    zkapK: number,
    zkapN: number
  ) {
    if (socialServices.length !== idTokenGenerators.length) {
      throw new Error("socialServices.length !== idTokenGenerators.length");
    }
    if (socialServices.length > 3) {
      throw new Error("socialServices.length must be <= 3 (max 3 OAuth providers supported)");
    }
    if (zkapN <= 0 || zkapN > 3) {
      throw new Error("zkapN must be between 1 and 3");
    }
    if (zkapK < 1 || zkapK > zkapN) {
      throw new Error(`zkapK must be between 1 and zkapN (got zkapK=${zkapK}, zkapN=${zkapN})`);
    }
    if (zkapK !== 1) {
      throw new Error(
        `ZkPasskeySigner currently supports only zkapK=1 (got zkapK=${zkapK}). ` +
        "For k>1 threshold proofs, use a signer path that provides multi-proof payloads."
      );
    }
    if (socialServices.length !== zkapN) {
      throw new Error(
        `socialServices.length (${socialServices.length}) must equal zkapN (${zkapN}). Each OAuth provider corresponds to one selector slot.`
      );
    }

    // Enforce HTTPS for proof server (except localhost and private network addresses)
    const proofUrl = new URL(proofServerUrl);
    if (proofUrl.protocol !== 'https:' && !ZkPasskeySigner._isLocalOrPrivateHost(proofUrl.hostname)) {
      throw new Error(
        'proofServerUrl must use HTTPS. HTTP is only allowed for localhost, 127.0.0.1, ' +
        'RFC1918 private addresses (10.x.x.x, 172.16-31.x.x, 192.168.x.x), and .local domains.'
      );
    }

    const validSocialServices = new Set(['google', 'kakao']);
    for (const service of socialServices) {
      if (!validSocialServices.has(service)) {
        throw new Error(`Unsupported social service: "${service}". Supported: google, kakao`);
      }
    }

    this.socialServices = socialServices;
    this.idTokenGenerators = idTokenGenerators;
    this.proofServerUrl = proofServerUrl;
    this.zkapAddress = zkapAddress;
    this.provider = new ethers.JsonRpcProvider(enUrl);
    this.poseidonMerkleTreeDirectoryAddress =
      poseidonMerkleTreeDirectoryAddress;
    // selector 길이는 idTokens와 동일하게 zkapN으로 설정합니다.
    // zkapK개의 true 슬롯 + (zkapN - zkapK)개의 false 슬롯
    // getSignatures()에서 3-슬롯으로 패딩될 때 false 슬롯은 더미 JWT로 채워집니다.
    this.selector = [
      ...Array(zkapK).fill(true),
      ...Array(zkapN - zkapK).fill(false),
    ];

    // idTokens : string[] = socialServices.length 만큼 초기화
    this.idTokens = Array(socialServices.length).fill("");
  }

  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this._doInit().catch((err) => {
        this.initPromise = undefined; // 실패 시 재시도 가능하게 초기화
        throw err;
      });
    }
    return this.initPromise;
  }

  private async _doInit(): Promise<void> {
    this.zkapAccount = new ethers.Contract(
      this.zkapAddress,
      zkapAccountJson.abi,
      this.provider
    );
    // masterKeyList(index) returns KeyRef { logic: address, keyId: uint256 }
    const masterKeyRef = await this.zkapAccount.masterKeyList(0);
    const masterKeyAddress: string = masterKeyRef.logic;
    if (!masterKeyAddress || masterKeyAddress === ethers.ZeroAddress) {
      throw new Error("masterKeyList returned invalid logic address (zero address)");
    }
    this.masterKeyId = masterKeyRef.keyId;

    this.zkOAuthRS256Verifier = new ethers.Contract(
      masterKeyAddress,
      AccountKeyZkOAuthRS256VerifierJson.abi,
      this.provider
    );
    // 스마트 컨트랙트로부터 앵커 가져오기 (KeyPurpose.Master = 0)
    {
      const anchor = await this.zkOAuthRS256Verifier.getAnchor(
        0,
        this.zkapAddress,
        this.masterKeyId
      );
      const anchorUint = anchor.map((x: bigint) => x.toString());
      this.anchor = anchorUint;
    }

    this.poseidonMerkleTreeDirectory = new ethers.Contract(
      this.poseidonMerkleTreeDirectoryAddress,
      poseidonMerkleTreeDirectoryJson.abi,
      this.provider
    );

    this.isInitialized = true;
  }

  private async getSignatures(
    idTokens: string[],
    jwtPks: string[],
    leafIndices: number[],
    merklePaths: string[][]
  ): Promise<string[]> {
    if (!this.poseidonMerkleTreeDirectory) {
      throw new Error("poseidonMerkleTreeDirectory is not initialized");
    }

    const rootHex = await this.poseidonMerkleTreeDirectory.getRoot();
    const root = ethers.toBigInt(rootHex).toString();

    let adjustedIdTokens: string[] = [];
    let adjustedPublicKeys: string[] = [];
    let adjustedLeafIndices: number[] = [];
    let adjustedMerklePaths: string[][] = [];
    let signatures: string[] = [];
    let proofAndPublicInput: { proof: string[]; publicInputs: string[] };

    if (idTokens.length === 0 || idTokens.length > 3) {
      throw new Error(`Invalid idTokens count: ${idTokens.length}. Must be 1, 2, or 3.`);
    }
    // 배열 길이 일치 검증
    if (jwtPks.length !== idTokens.length || leafIndices.length !== idTokens.length || merklePaths.length !== idTokens.length) {
      throw new Error(`Array length mismatch: idTokens(${idTokens.length}), jwtPks(${jwtPks.length}), leafIndices(${leafIndices.length}), merklePaths(${merklePaths.length}) must all match.`);
    }

    // ZK proof 회로는 항상 3개 슬롯을 받습니다.
    // selector 배열이 실제 사용 슬롯을 표시하므로, 빈 슬롯에 더미 JWT를 넣어도
    // 회로는 selector=false 슬롯을 무시합니다(크립토 안전성 보장).
    // e.g. length=1, selector=[true,false,false] → 슬롯 0만 검증
    // e.g. length=2, selector=[true,true,false] → 슬롯 0,1만 검증
    // RS256 signature requires 256 bytes = 342 base64url chars (without padding)
    // Use zero-padded valid-length dummy to avoid proof server JWT format errors on selector=false slots
    // Header: {"alg":"RS256","kid":"dummy"} - kid field required by some proof servers
    const DUMMY_JWT = `eyJhbGciOiJSUzI1NiIsImtpZCI6ImR1bW15In0.e30.${"A".repeat(342)}`;
    const dummyPk = jwtPks[0];
    const dummyLeafIndex = leafIndices[0];
    const dummyMerklePath = merklePaths[0];
    // selector=false 슬롯의 빈/falsy 값을 더미로 교체 후 3 슬롯으로 패딩
    // ZK circuit은 항상 3 슬롯을 받으므로, 1/2 슬롯 케이스는 더미로 채움
    adjustedIdTokens = idTokens.map(t => t || DUMMY_JWT);
    adjustedPublicKeys = jwtPks.map(pk => pk || dummyPk);
    adjustedLeafIndices = leafIndices.map(idx => (idx !== undefined && idx !== null) ? idx : dummyLeafIndex);
    adjustedMerklePaths = merklePaths.map(path => (path && path.length > 0) ? path : dummyMerklePath);
    while (adjustedIdTokens.length < 3) {
      adjustedIdTokens.push(DUMMY_JWT);
      adjustedPublicKeys.push(dummyPk);
      adjustedLeafIndices.push(dummyLeafIndex);
      adjustedMerklePaths.push(dummyMerklePath);
    }

    const now = Math.floor(Date.now() / 1000);
    // 2024-01-01 00:00:00 UTC 이전이면 기기 시계가 잘못된 것으로 간주
    const MIN_VALID_EPOCH = 1704067200;
    /* istanbul ignore next */
    if (now < MIN_VALID_EPOCH) {
      throw new Error(`System clock appears incorrect: timestamp ${now} is before 2024-01-01. Check device time settings.`);
    }
    // proof 서버에 전달하는 현재 시각 (Unix timestamp). 필드명 'exp'는 서버 API 규격에 맞춰 유지.
    const exp = now.toString();
    {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ZkPasskeySigner.PROOF_SERVER_TIMEOUT_MS);
      let fetchResponse: Response;
      try {
        fetchResponse = await fetch(`${this.proofServerUrl}/proof2`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            anchor: this.anchor,
            selector: this.selector,
            jwts: adjustedIdTokens,
            root: root,
            leafIndices: adjustedLeafIndices,
            merklePaths: adjustedMerklePaths,
            jwtPks: adjustedPublicKeys,
            exp: exp,
          }),
        });
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error(`Proof server request timed out after ${ZkPasskeySigner.PROOF_SERVER_TIMEOUT_MS}ms`);
        }
        throw fetchError;
      } finally {
        clearTimeout(timeoutId);
      }

      if (!fetchResponse.ok) {
        let errorBody = '';
        try { errorBody = await fetchResponse.text(); } catch { /* ignore */ }
        throw new Error(`Proof server error! status: ${fetchResponse.status}${errorBody ? `: ${errorBody}` : ''}`);
      }
      proofAndPublicInput = await fetchResponse.json();

      // proof server 응답 검증
      if (!Array.isArray(proofAndPublicInput.proof) || proofAndPublicInput.proof.length !== 8) {
        throw new Error(`Invalid proof server response: proof must be an array of 8 elements, got ${proofAndPublicInput.proof?.length}`);
      }
      if (!Array.isArray(proofAndPublicInput.publicInputs) || proofAndPublicInput.publicInputs.length !== 8) {
        throw new Error(`Invalid proof server response: publicInputs must be an array of 8 elements, got ${proofAndPublicInput.publicInputs?.length}`);
      }
      // BN254 scalar field 범위 검증 (ZkOidcSigner.setProofData와 동일한 검증)
      for (let i = 0; i < proofAndPublicInput.proof.length; i++) {
        let val: bigint;
        try { val = BigInt(proofAndPublicInput.proof[i]); } catch {
          throw new Error(`proof[${i}] is not a valid number: ${proofAndPublicInput.proof[i]}`);
        }
        if (val < 0n || val >= BN254_FR) {
          throw new Error(`proof[${i}] is out of BN254 scalar field range`);
        }
      }
      for (let i = 0; i < proofAndPublicInput.publicInputs.length; i++) {
        let val: bigint;
        try { val = BigInt(proofAndPublicInput.publicInputs[i]); } catch {
          throw new Error(`publicInputs[${i}] is not a valid number: ${proofAndPublicInput.publicInputs[i]}`);
        }
        if (val < 0n || val >= BN254_FR) {
          throw new Error(`publicInputs[${i}] is out of BN254 scalar field range`);
        }
      }

      // publicInputs[8] layout (matches Groth16 verifyInputs in AccountKeyZkOAuthRS256Verifier):
      // [0]=hanchor, [1]=h_ctx, [2]=root, [3]=h_sign_userop,
      // [4]=jwt_exp, [5]=partial_rhs, [6]=lhs, [7]=h_aud_list
      const sharedInputs = [
        proofAndPublicInput.publicInputs[0], // hanchor
        proofAndPublicInput.publicInputs[1], // h_ctx
        proofAndPublicInput.publicInputs[2], // root
        proofAndPublicInput.publicInputs[3], // h_sign_userop
        proofAndPublicInput.publicInputs[6], // lhs
        proofAndPublicInput.publicInputs[7], // h_aud_list
      ];
      const jwtExpList = [proofAndPublicInput.publicInputs[4]];
      const partialRhsList = [proofAndPublicInput.publicInputs[5]];
      const proofs = [proofAndPublicInput.proof];

      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      const encoded = abiCoder.encode(
        ["uint256[6]", "uint256[]", "uint256[]", "uint256[8][]"],
        [sharedInputs, jwtExpList, partialRhsList, proofs]
      );
      signatures.push(encoded);
    }
    return signatures;
  }

  /**
   * UserOp 해시에 대한 OAuth ID 토큰을 준비합니다.
   * @param userOpHash 서명할 UserOperation 해시
   * @param index OAuth 공급자 인덱스 (0-based)
   * @returns 현재까지 준비된 idTokens 배열 (부분 초기화 상태일 수 있음).
   *          모든 슬롯이 채워지기 전에 signUserOpHash()를 호출하면 에러가 발생합니다.
   *          각 인덱스마다 prepareIdToken()을 호출한 후 signUserOpHash()를 호출하세요.
   * @note Single-use per UserOp: 동일 인스턴스로 다른 userOpHash를 처리하려면 새 인스턴스를 생성하세요.
   *       userOpHash 변경 시 에러가 발생합니다.
   */
  async prepareIdToken(userOpHash: string, index: number): Promise<string[]> {
    if (this._prepareInProgress) {
      throw new Error("prepareIdToken: concurrent calls are not allowed. Await the previous call before calling again.");
    }
    this._prepareInProgress = true;
    try {
      if (!this.idTokens) throw new Error("idTokens is not initialized");
      if (!Number.isInteger(index) || index < 0 || index >= this.idTokens.length)
        throw new Error(`index is out of range: must be a non-negative integer less than ${this.idTokens.length}, got ${index}`);
      if (!this.isInitialized) {
        await this.init();
      }
      if (this.preparedUserOpHash !== undefined && this.preparedUserOpHash !== userOpHash) {
        throw new Error("[zkap-aa-sdk] prepareIdToken: userOpHash changed. Previous idTokens may be stale.");
      }
      this.preparedUserOpHash = userOpHash;
      if (!this.idTokenGenerators[index])
        throw new Error("idTokenGenerator undefined");
      const idToken = await this.idTokenGenerators[index](userOpHash);
      if (!idToken) throw new Error("idToken is undefined");

      this.idTokens[index] = idToken;
      return this.idTokens;
    } finally {
      this._prepareInProgress = false;
    }
  }

  async signUserOpHash(userOpHash: string): Promise<string[]> {
    if (this.preparedUserOpHash === undefined) {
      throw new Error(
        "prepareIdToken() must be called before signUserOpHash(). Call prepareIdToken(userOpHash) first."
      );
    }
    // H-2: userOpHash 형식 검증 (32바이트 hex, 66자)
    if (!/^0x[0-9a-fA-F]{64}$/.test(userOpHash)) {
      throw new Error(
        `signUserOpHash: userOpHash must be a 0x-prefixed 32-byte hex string (66 chars), got: ${userOpHash}`
      );
    }
    if (!this.isInitialized) {
      await this.init();
    }
    if (userOpHash !== this.preparedUserOpHash) {
      throw new Error(
        `signUserOpHash: userOpHash mismatch. Expected ${this.preparedUserOpHash}, got ${userOpHash}. Call prepareIdToken() with the correct userOpHash first.`
      );
    }
    // this.idTokens 가 모두 초기화 되어 있는지 확인
    if (!this.idTokens) throw new Error("idTokens is undefined");
    if (!this.selector || this.selector.length !== this.idTokens.length) {
      throw new Error("selector is not properly initialized");
    }
    // selector=true 슬롯만 실제로 사용되므로, 해당 슬롯의 idToken만 필수
    for (let i = 0; i < this.idTokens.length; i++) {
      if (this.selector && this.selector[i] === true && this.idTokens[i] === "") {
        throw new Error(`idToken[${i}] is not initialized (selector=true slot requires a token)`);
      }
    }

    // selector=true 슬롯만 JWT 파싱 및 JWKS 조회 수행
    // selector=false 슬롯은 빈 문자열로 처리 (회로에서 무시됨)
    const kids = this.idTokens.map((idToken, i) => {
      if (this.selector && this.selector[i] === false) return "";
      const header = decodeJwtHeader(idToken);
      return header.kid;
    });

    const jwtPks = await Promise.all(
      this.socialServices.map(async (service, index) => {
        if (this.selector && this.selector[index] === false) return "";
        if (service === "google") {
          return await getGoogleOAuthPublicKey(kids[index]);
        } else if (service === "kakao") {
          return await getKakaoOAuthPublicKey(kids[index]);
        } else {
          throw new Error("Invalid service");
        }
      })
    );

    /* istanbul ignore next */
    if (!this.poseidonMerkleTreeDirectory) {
      throw new Error("poseidonMerkleTreeDirectory is not initialized");
    }
    const merkleTreeDir = this.poseidonMerkleTreeDirectory;
    const results = await Promise.all(
      jwtPks.map(async (jwtPk, index) => {
        // selector=false 슬롯은 머클 경로 조회를 건너뛰고 더미값 반환 (회로에서 무시됨)
        if (this.selector && this.selector[index] === false) {
          return { leafIndex: 0, pathUint: [] as string[] };
        }
        const jwtHash = ethers.toBeHex(
          ethers.sha256(ethers.toUtf8Bytes(jwtPk)),
          32
        );
        const leafIndex =
          await merkleTreeDir.getLeafIndexByPubkeyHash(
            jwtHash
          );
        const path = await merkleTreeDir.getMerklePath(
          leafIndex
        );

        const pathUint = path.map((x: string) => ethers.toBigInt(x).toString());

        const leafIndexNum = Number(leafIndex);
        /* istanbul ignore next */
        if (!Number.isSafeInteger(leafIndexNum)) {
          throw new Error(`leafIndex ${leafIndex} exceeds safe integer range`);
        }
        return { leafIndex: leafIndexNum, pathUint };
      })
    );

    const leafIndices = results.map((r) => r.leafIndex as number);
    const merklePaths = results.map((r) => r.pathUint);

    return this.getSignatures(this.idTokens, jwtPks, leafIndices, merklePaths);
  }

  /**
   * 메모리에서 민감한 OAuth 토큰 및 앵커 데이터 참조를 제거합니다.
   * @note 민감한 토큰 데이터 재사용을 방지하기 위해 사용 후 호출하세요.
   */
  destroy(): void {
    this.idTokens = undefined;
    this.anchor = undefined;
    this.preparedUserOpHash = undefined;
    this.idTokenGenerators = [];
    this.isInitialized = false;
    this.initPromise = undefined;
    this.masterKeyId = undefined;
    this.zkapAccount = undefined;
    this.zkOAuthRS256Verifier = undefined;
    this.poseidonMerkleTreeDirectory = undefined;
  }

  private static _isLocalOrPrivateHost(hostname: string): boolean {
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    // IPv6 loopback: ::1 or [::1] (URL-bracketed form used by new URL())
    if (hostname === '::1' || hostname === '[::1]') return true;
    // IPv4-mapped IPv6: [::ffff:x.x.x.x] (dotted) or [::ffff:xxxx:xxxx] (hex, as normalized by new URL())
    const ipv4MappedMatch = hostname.match(/^\[::ffff:(.+)\]$/i);
    if (ipv4MappedMatch) {
      const mapped = ipv4MappedMatch[1];
      // Hex form: xxxx:xxxx → convert to dotted IPv4
      const hexMatch = mapped.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
      if (hexMatch) {
        const hi = parseInt(hexMatch[1], 16);
        const lo = parseInt(hexMatch[2], 16);
        const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
        return ZkPasskeySigner._isLocalOrPrivateHost(ipv4);
      }
      // Dotted decimal form: x.x.x.x
      return ZkPasskeySigner._isLocalOrPrivateHost(mapped);
    }
    if (hostname.endsWith('.local')) return true;
    // RFC1918 private ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x
    const parts = hostname.split('.').map(Number);
    if (parts.length === 4 && parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
      if (parts[0] === 10) return true;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      if (parts[0] === 192 && parts[1] === 168) return true;
    }
    return false;
  }
}
