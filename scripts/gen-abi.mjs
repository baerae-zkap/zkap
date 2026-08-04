/**
 * Generates lib/types/abi/generated.ts from the Hardhat artifacts in
 * lib/types/abi/*.json, emitting only each artifact's `abi` field.
 *
 * Why: native ESM rejects a bare `import x from "./x.json"` without an import
 * attribute, which made dist/esm/index.js unloadable in Node. Rather than add
 * `with { type: "json" }` (and the Node floor that implies), the runtime JSON
 * import is removed entirely. The .json files stay in the repo as the synced
 * artifact — they are simply no longer part of the TypeScript program, which is
 * also what stops tsc from copying ~820 KB of unused contract bytecode and
 * metadata into dist/lib and dist/esm.
 *
 * The output is byte-deterministic (sorted inputs, fixed indentation, fixed
 * trailing newline) so CI can assert that regenerating is a no-op.
 *
 * Usage: node scripts/gen-abi.mjs
 */

import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const ABI_DIR = fileURLToPath(new URL("../lib/types/abi", import.meta.url));
const OUT_FILE = join(ABI_DIR, "generated.ts");

const HEADER = `// GENERATED FILE — do not edit by hand.
// Run \`node scripts/gen-abi.mjs\` to regenerate from lib/types/abi/*.json.
//
// Holds only each artifact's \`abi\` field. Importing the .json files directly
// is deliberately avoided: native ESM requires an import attribute for JSON,
// and shipping the full Hardhat artifacts adds ~820 KB of bytecode/metadata to
// dist that no runtime code reads.
`;

/**
 * Hardhat artifacts wrap the ABI in an `abi` field. ERC20.json is a bare array
 * of human-readable signatures instead, so it is unwrapped differently and
 * typed `string[]` to match the surface published before this module existed.
 */
function readAbi(fileName) {
  const parsed = JSON.parse(readFileSync(join(ABI_DIR, fileName), "utf8"));
  if (Array.isArray(parsed)) {
    return { abi: parsed, type: "string[]" };
  }
  if (!Array.isArray(parsed.abi)) {
    throw new Error(
      `${fileName}: expected a bare array or an object with an \`abi\` array, got ${Object.keys(parsed).join(", ")}`
    );
  }
  return { abi: parsed.abi, type: "any[]" };
}

const files = readdirSync(ABI_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort();

if (files.length === 0) {
  throw new Error(`No .json artifacts found in ${ABI_DIR}`);
}

const blocks = files.map((fileName) => {
  const constName = `${fileName.replace(/\.json$/, "")}ABI`;
  const { abi, type } = readAbi(fileName);
  return `export const ${constName}: ${type} = ${JSON.stringify(abi, null, 2)};\n`;
});

writeFileSync(OUT_FILE, `${HEADER}\n${blocks.join("\n")}`, "utf8");

console.log(`Generated ${files.length} ABI consts -> lib/types/abi/generated.ts`);
