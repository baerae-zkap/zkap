/**
 * AccountReader — the `{ rpcUrl }` constructor path.
 *
 * The provider ethers builds is real; only its `call` / `getCode` / `getBalance`
 * are stubbed on the prototype, so nothing reaches the network and no module
 * mock is needed.
 */
import { ethers } from "ethers";
import { AccountReader } from "../AccountReader";
import { AaFetchError, AaFetchErrorCode } from "../../errors";
import { fakeChain, webauthnSlot, zkapAccount, CODE } from "../../__tests__/helpers/fakeEthCall";

const RPC_URL = "https://rpc.example.com";
const ACCOUNT = "0x" + "11".repeat(20);
const LOGIC = "0x" + "aa".repeat(20);

describe("AccountReader({ rpcUrl })", () => {
  let callSpy: jest.SpyInstance;
  let getCodeSpy: jest.SpyInstance;
  let getBalanceSpy: jest.SpyInstance;

  beforeEach(() => {
    callSpy = jest.spyOn(ethers.JsonRpcProvider.prototype, "call");
    getCodeSpy = jest.spyOn(ethers.JsonRpcProvider.prototype, "getCode");
    getBalanceSpy = jest.spyOn(ethers.JsonRpcProvider.prototype, "getBalance");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function wire(chain: ReturnType<typeof fakeChain>) {
    callSpy.mockImplementation((tx: { to?: unknown; data?: unknown }) =>
      chain.call({ to: tx.to as string, data: tx.data as string }),
    );
    getCodeSpy.mockImplementation((address: string) => chain.getCode(address));
  }

  it("constructs with and without chainId", () => {
    expect(() => new AccountReader({ rpcUrl: RPC_URL, chainId: 42161 })).not.toThrow();
    expect(() => new AccountReader({ rpcUrl: RPC_URL })).not.toThrow();
  });

  it("isDeployed and getBalance delegate to the provider", async () => {
    getCodeSpy.mockResolvedValueOnce(CODE).mockResolvedValueOnce("0x");
    getBalanceSpy.mockResolvedValueOnce(BigInt(42));

    const reader = new AccountReader({ rpcUrl: RPC_URL, chainId: 1 });
    expect(await reader.isDeployed(ACCOUNT)).toBe(true);
    expect(await reader.isDeployed(ACCOUNT)).toBe(false);
    expect(await reader.getBalance(ACCOUNT)).toBe("42");
  });

  it("reads txKeys through the provider's call", async () => {
    const chain = fakeChain(
      zkapAccount(ACCOUNT, [
        webauthnSlot({ logic: LOGIC, keyId: 0, credentialId: "cred", rpId: "zkap.app", origin: "https://zkap.app" }),
      ]),
    );
    wire(chain);

    const reader = new AccountReader({ rpcUrl: RPC_URL });
    const keys = await reader.getTxKeyList(ACCOUNT);
    expect(keys).toHaveLength(1);
    expect(keys[0].webauthn?.credentialId).toBe("cred");
    expect(callSpy).toHaveBeenCalledTimes(2);
  });

  it("uses eth_getCode to confirm a missing Multicall3", async () => {
    const chain = fakeChain(
      zkapAccount(ACCOUNT, [
        webauthnSlot({ logic: LOGIC, keyId: 0, credentialId: "cred", rpId: "zkap.app", origin: "https://zkap.app" }),
      ]),
      { multicall: "absent" },
    );
    wire(chain);

    const reader = new AccountReader({ rpcUrl: RPC_URL });
    const slots = await reader.readTxKeySlots(ACCOUNT);
    expect(slots.readVia).toBe("direct");
    expect(getCodeSpy).toHaveBeenCalledTimes(1);
  });

  it("carries the rpcUrl on a transport failure", async () => {
    callSpy.mockRejectedValue(new Error("socket hang up"));
    const reader = new AccountReader({ rpcUrl: RPC_URL, chainId: 1 });
    const promise = reader.getTxKeyList(ACCOUNT);
    await expect(promise).rejects.toBeInstanceOf(AaFetchError);
    await expect(promise).rejects.toMatchObject({ code: AaFetchErrorCode.TRANSPORT, url: RPC_URL });
  });
});
