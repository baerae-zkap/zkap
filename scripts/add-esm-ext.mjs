/**
 * Post-build: add .js extensions to relative imports/exports in dist/esm/
 *
 * TypeScript ESM output omits .js extensions on relative imports, which are
 * required by Node.js native ESM. This script patches the output so the ESM
 * build works for both bundlers and direct Node.js imports.
 *
 * Handles two cases:
 * - "./types/UserOperation" → "./types/UserOperation.js"  (file)
 * - "./types/abi"           → "./types/abi/index.js"      (directory with index)
 *
 * Then writes dist/esm/package.json with {"type":"module"}. Without it Node
 * treats every dist/esm/*.js as CommonJS — newer versions rescue it via
 * module-syntax detection (with a perf warning), older ones fail outright.
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const ESM_DIR = fileURLToPath(new URL('../dist/esm', import.meta.url));

function walkJs(dir) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    // bearer:disable javascript_lang_path_traversal
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkJs(full);
    } else if (extname(entry) === '.js') {
      patchFile(full);
    }
  }
}

function resolveExtension(importingFile, importPath) {
  // bearer:disable javascript_lang_path_traversal
  const base = join(dirname(importingFile), importPath);
  // Check if it resolves as a directory with index.js
  if (existsSync(base) && statSync(base).isDirectory()) {
    return `${importPath}/index.js`;
  }
  // Default: append .js
  return `${importPath}.js`;
}

function patchFile(filePath) {
  const src = readFileSync(filePath, 'utf8');
  const patched = src.replace(
    /((?:import|export)[^'"]*from\s+['"])(\.\.?\/[^'"]+?)(['"]\s*;?)/g,
    (match, prefix, importPath, suffix) => {
      if (/\.[a-z]+$/.test(importPath)) return match; // already has extension
      const resolved = resolveExtension(filePath, importPath);
      return `${prefix}${resolved}${suffix}`;
    }
  );
  if (patched !== src) {
    writeFileSync(filePath, patched, 'utf8');
  }
}

walkJs(ESM_DIR);
console.log('ESM .js extensions patched');

// Mark dist/esm as ESM. Only the `type` field — an `exports` field here would
// turn dist/esm into a resolution boundary and break Metro's resolution of the
// package's own relative imports inside it.
writeFileSync(join(ESM_DIR, 'package.json'), '{"type":"module"}\n', 'utf8');
console.log('ESM module marker written (dist/esm/package.json)');
