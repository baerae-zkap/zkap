/**
 * safeStringify — defensive wrapper used to snapshot bundler/paymaster
 * responses as a string at throw time. Must never itself throw, since callers
 * embed the result in `rawBundlerError` / `rawResponse` from inside error
 * constructors.
 */
import { safeStringify } from "../safeStringify";

describe("safeStringify", () => {
  it("returns string inputs unchanged", () => {
    expect(safeStringify("hello")).toBe("hello");
    expect(safeStringify("")).toBe("");
  });

  it("JSON-stringifies plain objects and arrays", () => {
    expect(safeStringify({ a: 1, b: "x" })).toBe('{"a":1,"b":"x"}');
    expect(safeStringify([1, 2, 3])).toBe("[1,2,3]");
  });

  it("falls back to String() when JSON.stringify returns undefined (functions, undefined values)", () => {
    // JSON.stringify(undefined) and JSON.stringify(fn) return undefined — the
    // `s !== undefined` arm. We must not return the literal string "undefined"
    // from JSON; instead fall through to the String() representation.
    expect(safeStringify(undefined)).toBe("undefined");
    expect(safeStringify(() => 1)).toMatch(/^\(?\s*\)?\s*=>|^function/);
  });

  it("falls back to String() when JSON.stringify throws (circular ref)", () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj; // JSON.stringify → TypeError; String() returns "[object Object]"
    expect(safeStringify(obj)).toBe("[object Object]");
  });

  it("falls back to '[unstringifiable]' when both JSON.stringify and String() throw", () => {
    // Circular → JSON.stringify throws. Then String() invokes toString(), which
    // we override to throw — this is the only path that should ever hit the
    // final '[unstringifiable]' sentinel.
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    obj.toString = () => { throw new Error("toString boom"); };
    expect(safeStringify(obj)).toBe("[unstringifiable]");
  });
});
