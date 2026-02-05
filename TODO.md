# ZKAP AA SDK - Improvement TODO

This document outlines priority improvements for the ZKAP AA SDK, organized by criticality and impact. Each item includes specific file references, effort estimates, and actionable implementation steps.

---

## Priority 1: Critical (Security & Correctness)

Issues that could cause production failures or security vulnerabilities.

### 1.1 Add keyTypes property to IUserOpSigner interface

**File**: `lib/utils/IUserOpSigner.ts`
**Category**: Architecture | Type Safety
**Estimated Effort**: 30 minutes
**Status**: Open

**Current Issue**:
- `IUserOpSigner` interface only defines `signUserOpHash()` method
- All implementations (PasskeySigner, ZkPasskeySigner, AddressKeySigner, ZkOidcSigner) manually define `public keyTypes: number[]`
- No type safety: implementations can forget to define keyTypes
- ZkapBuilder relies on keyTypes but interface doesn't guarantee it exists

**Proposed Solution**:
Make `keyTypes` a required property on the interface to enforce contract compliance across all signers.

**Implementation Steps**:
1. Update `IUserOpSigner` to include `keyTypes: number[]` property
2. Verify all signer implementations still compile (they should - they already have it)
3. Update any code that accesses `userOpSigner.keyTypes` to ensure it's now type-safe
4. Add test to verify implementations comply with interface
5. Run `npm test` and `npx tsc --noEmit` to verify no breakage

**Testing**:
- [ ] All signer tests pass
- [ ] TypeScript compilation succeeds
- [ ] lsp_diagnostics shows no errors

---

### 1.2 Validate private key format in AddressKeySigner

**File**: `lib/signers/AddressKeySigner.ts:9-11`
**Category**: Validation | Security
**Estimated Effort**: 1 hour
**Status**: Open

**Current Issue**:
- Constructor accepts `privateKeys: string[]` with zero validation
- Invalid keys (wrong length, wrong format, not hex) only fail when `ethers.Wallet` tries to use them
- Errors propagate late during signing, not at initialization
- No documentation about expected format

**Proposed Solution**:
Validate private key format at construction time, fail fast with clear error messages.

**Implementation Steps**:
1. Add validation in constructor before storing keys:
   - Check each key is valid hex string using `ethers.isHexString(pk, 32)` (ethers v6 API)
   - Note: This is ethers v6 syntax, not v5's `ethers.utils.isHexString()`
2. Add JSDoc comments explaining expected format (0x-prefixed 32-byte hex)
3. Add specific error messages for each failure case
4. Create unit tests with invalid inputs (too short, no 0x, non-hex chars)
5. Test that valid keys still work correctly

**Testing**:
- [ ] Test with invalid key length (too short/long)
- [ ] Test with non-hex characters
- [ ] Test with missing 0x prefix
- [ ] Test that valid keys still work

---

### 1.3 Fix hardcoded USDC address in PaymasterService

**File**: `lib/utils/PaymasterService.ts:142`
**Category**: Configuration | Production Risk
**Estimated Effort**: 1-2 hours
**Status**: Open

**Current Issue**:
```typescript
// Line 142 in getPaymasterDataErc20()
"0x036CbD53842c5426634e7929541eC2318f3dCF7e",  // Hardcoded USDC address
```
- USDC address is hardcoded in ERC20 paymaster mode
- This address may be wrong for different chains
- Cannot be configured or overridden by users
- Production deployments to other chains will fail silently or use wrong token

**Proposed Solution**:
Make token address configurable in PaymasterServiceConfig with validation.

**Implementation Steps**:
1. Add `tokenAddress?: string` to `PaymasterServiceConfig` interface
2. When `mode` is `PaymasterMode.ERC20`, `tokenAddress` is **required** - throw error if not provided
3. Update constructor to validate and store token address
4. Update `getPaymasterDataErc20()` to use configured tokenAddress instead of hardcoded value
5. Add validation using `ethers.isAddress()`
6. Add JSDoc documentation with example usage for different chains
6. Update tests to use configurable address
7. Add migration note to CHANGELOG

**Testing**:
- [ ] Test with multiple token addresses (USDC, USDT on different chains)
- [ ] Test with invalid address format
- [ ] Verify error thrown when tokenAddress missing in ERC20 mode
- [ ] Test VERIFYING mode still works without tokenAddress
- [ ] Integration test with actual paymaster server

---

### 1.4 Fix preVerificationGas hardcoding to 25000

**File**: `lib/builders/ZkapBuilder.ts:244`
**Category**: Configuration | Gas Estimation
**Estimated Effort**: 2 hours
**Status**: Open

**Current Issue**:
```typescript
// Line 244
this.userOp.preVerificationGas = ethers.toBeHex("25000"); // Fixed to 25000
```
- preVerificationGas is hardcoded to 25000
- Actual preVerificationGas depends on calldata length (per EIP-4337)
- Formula: 21000 + (calldata_length * 16) + initCode_overhead
- Current value insufficient for large transactions, wasteful for small ones
- Users cannot override this critical gas parameter

**Proposed Solution**:
Calculate preVerificationGas based on actual UserOperation size, allow configuration.

**Implementation Steps**:
1. Extract preVerificationGas calculation logic from BaseAccountBuilder.calculatePreVerificationGas() (lines 338-355)
2. Refactor into a reusable method in ZkapBuilder
3. Call this method in autoFillUserOp() instead of hardcoding "25000"
4. Add setter method `setPreVerificationGas()` that validates input is reasonable
5. Add configuration option in ZkapAccountInfo for custom preVerificationGas override
6. Document that auto-calculation is default but can be overridden
7. Add tests verifying calculation matches EIP-4337 formula

**Testing**:
- [ ] preVerificationGas increases with larger calldata
- [ ] preVerificationGas includes initCode overhead when present
- [ ] Manual override works and is respected
- [ ] Calculation matches EIP-4337 spec examples

---

### 1.5 Add JWKS caching in ZkPasskeySigner

**File**: `lib/signers/ZkPasskeySigner.ts:16-59`
**Category**: Performance | Reliability
**Estimated Effort**: 3-4 hours
**Status**: Open

**Current Issue**:
- `getGoogleOAuthPublicKey()` and `getKakaoOAuthPublicKey()` fetch JWKS on every signature
- No caching: each signature makes 1-2 HTTP requests to Google/Kakao
- Performance: adds 200-500ms per signature operation
- Reliability: network failures block signing (no fallback to cache)
- Rate limit risk: no caching means rapid requests on key misses

**Proposed Solution**:
Implement dynamic TTL-based JWKS cache using Cache-Control headers.

**Implementation Steps**:
1. Create JwksCache class with:
   - In-memory cache of JWKS responses with metadata
   - Dynamic TTL from `Cache-Control: max-age` header (if present)
   - Fallback to 24-hour default if header missing
   - Thread-safe access (or closure-based for single-threaded JS)
2. Update fetch logic to parse Cache-Control header
3. Modify `getGoogleOAuthPublicKey()` and `getKakaoOAuthPublicKey()` to:
   - Check cache first (if not expired)
   - Fetch from endpoint only on cache miss/expiration
   - Store result with expiration time based on header
4. Handle key rotation: verify kid exists in fresh JWKS before using cached
5. Add method to manually clear cache
6. Add configuration option to override TTL if needed

**Testing**:
- [ ] Same key requested twice uses cache (no second HTTP request)
- [ ] Cache respects Cache-Control max-age header
- [ ] Cache expires after TTL, fetches again
- [ ] Falls back to 24h default when header missing
- [ ] Different kids fetched separately
- [ ] Network error on cache miss is propagated
- [ ] Manual cache clear works
- [ ] Cache-Control header parsing works correctly

---

### 1.6 Enable strictNullChecks in TypeScript configuration

**File**: `tsconfig.json:15` and multiple source files
**Category**: Type Safety | Maintainability
**Estimated Effort**: 4-6 hours
**Status**: Open

**Current Issue**:
```json
"strictNullChecks": false
```
- Disables null safety checks: `null` and `undefined` not type-checked
- Risk: NullPointerException at runtime on falsy checks
- Examples in codebase:
  - `this.userOp.sender` accessed without null check (line 79, 191)
  - `this.provider` used without verification in multiple methods
  - Ternary operators assume non-null values

**Proposed Solution**:
Enable strictNullChecks and fix all resulting type errors throughout codebase.

**Implementation Steps**:
1. Enable `strictNullChecks: true` in tsconfig.json
2. Run `npx tsc --noEmit` to identify all compilation errors
3. Fix errors in priority order:
   - **ZkapBuilder.ts**: Add null checks for `this.userOp.callData`, `this.userOp.sender`
   - **BaseAccountBuilder.ts**: Add null checks for optional UserOperation fields
   - **PaymasterService.ts**: Validate response objects before accessing nested properties
4. Use appropriate null handling patterns:
   - Optional chaining (`?.`) for safe property access
   - Nullish coalescing (`??`) for default values
   - Explicit null checks for critical paths
5. Document non-null assertions (`!`) with justification
6. Run full test suite to ensure no runtime regressions
7. Verify all tests still pass with strict checking enabled

**Testing**:
- [ ] `npx tsc --noEmit` succeeds with no errors
- [ ] All 394 tests pass
- [ ] Coverage remains at 95%+
- [ ] No runtime null/undefined errors in integration tests

---

## Priority 2: High (Reliability & Robustness)

Improvements that prevent errors and make the system more robust.

### 2.1 Add array length validation in setExecuteBatchCallData

**File**: `lib/builders/ZkapBuilder.ts:461-476`
**Category**: Validation | Input Safety
**Estimated Effort**: 1 hour
**Status**: Open

**Current Issue**:
```typescript
setExecuteBatchCallData(
  contractAddresses: string[],
  values: ethers.BigNumberish[],
  data: string[]
): this {
  // No validation that arrays have same length
  const callDataBuilder = new CallDataBuilder(ZkapAccountABIstring);
  const useropCallData = callDataBuilder.encode("executeBatch", [
    contractAddresses,
    values,
    data,
  ]);
  // ...
}
```
- Arrays must have equal length for valid executeBatch call
- No validation currently: mismatched lengths silently encode invalid calldata
- Fails later during transaction execution with cryptic error
- No helpful error message to guide developer

**Proposed Solution**:
Validate array lengths match before encoding, throw specific error if not.

**Implementation Steps**:
1. At start of setExecuteBatchCallData, add validation:
   ```typescript
   if (contractAddresses.length !== values.length ||
       contractAddresses.length !== data.length) {
     throw new Error(
       `Array length mismatch in setExecuteBatchCallData: ` +
       `addresses=${contractAddresses.length}, ` +
       `values=${values.length}, ` +
       `data=${data.length}. All must be equal.`
     );
   }
   ```
2. Also add check for empty arrays (should probably fail early)
3. Add JSDoc @throws documentation
4. Add unit tests:
   - Valid equal-length arrays
   - Mismatched address/values lengths
   - Mismatched values/data lengths
   - Empty arrays

**Testing**:
- [ ] Valid equal-length arrays pass
- [ ] Specific error on address/values mismatch
- [ ] Specific error on values/data mismatch
- [ ] Error message is clear and actionable

---

### 2.2 Add address validation to setter methods

**File**: `lib/builders/BaseAccountBuilder.ts` (lines 190-250)
**Category**: Validation | Input Safety
**Estimated Effort**: 1.5 hours
**Status**: Open

**Current Issue**:
- `setSender()`, `setPaymaster()`, etc. accept any string
- No validation that string is valid Ethereum address
- Invalid addresses silently stored, fail later during signing/submission
- No helpful error message when address is wrong

**Proposed Solution**:
Add `ethers.isAddress()` validation to address setter methods.

**Implementation Steps**:
1. Identify all address setters:
   - setSender()
   - setPaymaster()
   - (check others in BaseAccountBuilder)
2. For each, add validation before storing:
   ```typescript
   setSender(sender: string): this {
     if (!ethers.isAddress(sender)) {
       throw new Error(`Invalid sender address: ${sender}`);
     }
     this.userOp.sender = sender;
     return this;
   }
   ```
3. Add JSDoc @param documentation indicating Ethereum address required
4. Add tests for invalid formats:
   - Too short (not 42 chars)
   - Non-hex characters
   - Missing 0x prefix (note: ethers allows this, decide if to allow)
   - Valid checksummed and non-checksummed addresses

**Testing**:
- [ ] Valid addresses accepted (with and without checksum)
- [ ] Invalid addresses rejected with clear error
- [ ] Existing tests still pass

---

### 2.3 Improve error handling to preserve context

**File**: Multiple (see examples below)
**Category**: Reliability | Debugging
**Estimated Effort**: 2-3 hours
**Status**: Open

**Current Issue**:
```typescript
// Line 155 in ZkapBuilder
catch (error) {
  console.error("Failed to parse callData for gas estimation:", error);
  throw new Error("callData could not be parsed. Manual callGasLimit required.");
  // Original error lost, stack trace broken
}
```
- Error chains lose original error information
- Stack traces cut short, harder to debug
- No indication what the original problem was

**Proposed Solution**:
Use error chaining (`throw new Error("message", { cause: error })`) to preserve context.

**Implementation Steps**:
1. Find all try-catch blocks that re-throw (search for `throw new Error`)
2. Update to chain errors:
   ```typescript
   catch (error) {
     throw new Error(
       "callData could not be parsed. Manual callGasLimit required.",
       { cause: error }  // Preserve original error
     );
   }
   ```
3. Verify error chaining works in Node.js version target (ES2022+)
4. Test that error.cause is accessible when caught
5. Update error logging to show cause if present

**Locations to fix**:
- BaseAccountBuilder.estimateUserOpGasCost() (line 329)
- ZkapBuilder.estimateCallGasLimit() (line 156)
- Multiple catch blocks in PaymasterService

**Testing**:
- [ ] Original error accessible via error.cause
- [ ] Stack trace maintained for debugging
- [ ] Error message still user-friendly

---

### 2.4 Fix callGasLimit estimation for wallet creation (1000 gas insufficient)

**File**: `lib/builders/ZkapBuilder.ts:99`
**Category**: Gas Estimation
**Estimated Effort**: 2 hours
**Status**: Open

**Current Issue**:
```typescript
// Line 98-99: When wallet being created with no callData
if (!this.userOp.callData || this.userOp.callData === "0x") {
  return ethers.toBeHex("1000"); // 1000 gas is too low!
}
```
- Returns 1000 gas for wallet creation with no subsequent calls
- Actual gas cost much higher (account initialization, storage writes)
- Transactions will run out of gas and revert
- User has no way to override this value before autoFillUserOp()

**Proposed Solution**:
Estimate based on initCode complexity, increase minimum, make configurable.

**Implementation Steps**:
1. Research typical gas costs for wallet creation (50,000-100,000 gas)
2. Create constant `DEFAULT_CREATE_ACCOUNT_GAS = 100000`
3. Replace hardcoded 1000 with this constant
4. Add method to estimate initCode gas based on factory complexity (if possible)
5. Add configuration option in ZkapAccountInfo to override minimum
6. Document this value and why it's a minimum
7. Add tests with actual wallet creation (integration test)

**Testing**:
- [ ] Wallet creation with no callData estimates at least 50k gas
- [ ] Override value is respected
- [ ] Integration test: wallet creation actually succeeds with estimated gas
- [ ] callGasLimit for basic operations adequate

---

### 2.5 Validate paymaster address using ethers.isAddress

**File**: `lib/builders/BaseAccountBuilder.ts:230-233`
**Category**: Validation
**Estimated Effort**: 30 minutes
**Status**: Open

**Current Issue**:
```typescript
setPaymaster(paymaster: string): this {
  this.userOp.paymaster = paymaster;  // No validation
  return this;
}
```
- Accepts any string, no validation
- Invalid paymaster addresses silently accepted
- Fails during UserOp submission with generic error

**Proposed Solution**:
Add address validation, allow ZeroAddress (means no paymaster).

**Implementation Steps**:
1. Update setPaymaster():
   ```typescript
   setPaymaster(paymaster: string): this {
     if (paymaster !== ethers.ZeroAddress && !ethers.isAddress(paymaster)) {
       throw new Error(`Invalid paymaster address: ${paymaster}`);
     }
     this.userOp.paymaster = paymaster;
     return this;
   }
   ```
2. Add JSDoc noting ZeroAddress means no paymaster
3. Add tests for valid addresses, invalid addresses, ZeroAddress

**Testing**:
- [ ] Valid address accepted
- [ ] ZeroAddress accepted (no paymaster)
- [ ] Invalid address rejected
- [ ] Error message clear

---

## Priority 3: Medium (Maintainability & Quality)

Improvements that improve code quality, reduce maintenance burden, and developer experience.

### 3.1 Remove ~600 lines of commented-out code

**File**: `lib/builders/ZkapBuilder.ts:344-370`
**Category**: Code Cleanup | Maintainability
**Estimated Effort**: 1 hour
**Status**: Open

**Current Issue**:
```typescript
// Lines 344-370: Large block of commented-out code (27 lines)
// async completeUserOp(): Promise<this> {
//   if (this.userOp.sender === ethers.ZeroAddress) {
//     throw new Error("Required fields are missing");
//   }
//   // ... 20 more lines
// }
```
- Commented methods no longer used (replaced by autoFillUserOp)
- Adds ~27 lines of dead code
- Clutters file, confuses new developers
- If code was important, it should be in git history or tests

**Proposed Solution**:
Delete all commented-out code blocks. Trust git history for recovery if needed.

**Implementation Steps**:
1. Identify all commented code blocks (search for `// async`, `// function`, etc.)
2. Verify each is truly dead (search for references)
3. Check git log to understand why it was commented (for migration notes)
4. Remove all commented blocks
5. Clean up any orphaned comments left behind
6. Verify tests still pass

**Locations**:
- ZkapBuilder lines 344-370 (completeUserOp methods)
- Other files: search codebase for similar patterns

**Testing**:
- [ ] All tests still pass
- [ ] No references to removed methods

---

### 3.2 Refactor PaymasterService duplication

**File**: `lib/utils/PaymasterService.ts`
**Category**: DRY | Maintainability
**Estimated Effort**: 1.5 hours
**Status**: Open

**Current Issue**:
```typescript
// Two nearly identical methods (lines 58-111, 113-167)
async getPaymasterDataVerifying(userOp: UserOperation): Promise<string>
async getPaymasterDataErc20(userOp: UserOperation): Promise<string>
```
- Both methods follow identical fetch/response pattern
- Only differ in endpoint URL and params array
- ~60 lines of code duplication
- Bug fixes need to be applied twice

**Proposed Solution**:
Extract common fetch logic into shared helper, keep only mode-specific parts separate.

**Implementation Steps**:
1. Create private helper method:
   ```typescript
   private async fetchPaymasterData(
     endpoint: string,
     params: any[]
   ): Promise<string>
   ```
2. Move fetch logic (lines 59-91, 114-147) into helper
3. Move response validation (lines 99-110, 155-166) into helper
4. Update both methods to call helper with their specific endpoint/params
5. Result: 50% less code duplication
6. Easier to add future modes (e.g., Gasless mode)

**Testing**:
- [ ] Both VERIFYING and ERC20 modes still work
- [ ] Response validation unchanged
- [ ] Error cases still handled correctly

---

### 3.3 Extract magic numbers to configurable constants

**File**: `lib/builders/ZkapBuilder.ts` (gas constants)
**Category**: Configuration | Maintainability
**Estimated Effort**: 1.5 hours
**Status**: Open

**Current Issue**:
```typescript
// Lines 262-264: Magic numbers scattered in autoFillUserOp()
const ADDRESS_KEY_VALIDATION_GAS = 15000n;
const WEB_AUTHN_KEY_VALIDATION_GAS = 470000n;
const ZK_OAUTH_RS256_KEY_VALIDATION_GAS = 340000n;
```
- Gas constants hardcoded in method
- If actual costs change, buried in code
- No single source of truth
- Same constants may be duplicated elsewhere
- Cannot be configured per network/contract version

**Proposed Solution**:
Extract to a GasEstimates interface and make configurable.

**Implementation Steps**:
1. Create `GasEstimates` interface:
   ```typescript
   export interface GasEstimates {
     addressKeyValidation: bigint;
     webAuthnKeyValidation: bigint;
     zkOAuthKeyValidation: bigint;
     walletCreation: bigint;
     gasBuffer: bigint;
   }
   ```
2. Create default instance:
   ```typescript
   export const DEFAULT_GAS_ESTIMATES: GasEstimates = { ... }
   ```
3. Accept optional override in ZkapAccountInfo
4. Use override or defaults in autoFillUserOp()
5. Add JSDoc explaining where values come from (measurement, spec)

**Testing**:
- [ ] Default values work as before
- [ ] Custom gas estimates respected
- [ ] Can override individual values

---

### 3.4 Extract ZkPasskeySigner array padding logic

**File**: `lib/signers/ZkPasskeySigner.ts:157-172`
**Category**: Code Clarity | Maintainability
**Estimated Effort**: 1 hour
**Status**: Open

**Current Issue**:
```typescript
// Lines 157-172: Complex array padding logic
if (idTokens!.length == 1) {
  adjustedIdTokens = [idTokens[0], idTokens[0], idTokens[0]];
  adjustedPublicKeys = [jwtPks[0], jwtPks[0], jwtPks[0]];
  // ... 8 more lines duplicating pattern
}
```
- Pads arrays to exactly 3 elements for proof generation
- Logic duplicated for idTokens, publicKeys, leafIndices, merklePaths
- Hard to understand why 3 elements specifically
- Hard to maintain if this constraint changes

**Proposed Solution**:
Extract into reusable utility function with clear documentation.

**Implementation Steps**:
1. Create utility function:
   ```typescript
   function padArrayTo3<T>(arr: T[]): T[] {
     const TARGET_LENGTH = 3; // For zk-proof compatibility
     if (arr.length === 1) return [arr[0], arr[0], arr[0]];
     if (arr.length === 2) return [arr[0], arr[0], arr[1]];
     if (arr.length === 3) return [...arr];
     throw new Error(`Array length ${arr.length} not supported`);
   }
   ```
2. Use in getSignatures():
   ```typescript
   adjustedIdTokens = padArrayTo3(idTokens);
   adjustedPublicKeys = padArrayTo3(jwtPks);
   ```
3. Add JSDoc explaining why padding is needed (zk-proof requirement)
4. Add tests for each padding case (1, 2, 3 elements)

**Testing**:
- [ ] 1-element arrays pad to [x, x, x]
- [ ] 2-element arrays pad to [x, x, y]
- [ ] 3-element arrays unchanged
- [ ] Behavior identical before refactor

---

### 3.5 Type SwapBuilder.aggregator properly

**File**: `lib/builders/SwapBuilder.ts`
**Category**: Type Safety
**Estimated Effort**: 1 hour
**Status**: Open

**Current Issue**:
- `aggregator` property type not enforced
- Can be any value, should be specific type or union
- No type hints for IDE autocomplete

**Proposed Solution**:
Create proper types for aggregator configurations.

**Implementation Steps**:
1. Review SwapBuilder implementation
2. Define aggregator type (e.g., `OneInchAggregator | OtherAggregator`)
3. Update property type annotation
4. Add tests for type safety
5. Verify no runtime behavior changes

**Testing**:
- [ ] TypeScript types enforced
- [ ] IDE autocomplete works
- [ ] All tests pass

---

### 3.6 Implement sendTransaction or remove from interface

**File**: `lib/account/BaseAccount.ts` (search for sendTransaction)
**Category**: Interface Completeness
**Estimated Effort**: 2-3 hours
**Status**: Open

**Current Issue**:
- BaseAccount may declare `sendTransaction()` but not implement it
- Interface incomplete, confusing for users
- Either should be implemented or explicitly marked as unsupported

**Proposed Solution**:
Either implement sendTransaction with proper UserOp signing and submission, or remove from interface and document why.

**Implementation Steps**:
1. Check BaseAccount/ZkapAccount for sendTransaction definition
2. If method exists but incomplete:
   - Complete implementation with UserOp flow
   - Or remove and document that use builder pattern instead
3. Update JSDoc with rationale
4. Add tests or add note about why not testable
5. Consider if users need this method

**Testing**:
- [ ] If implemented: test sending actual transaction
- [ ] If removed: verify no code calls it

---

## Priority 4: Low (Technical Debt)

Nice-to-have improvements and technical debt.

### 4.1 Add comprehensive JSDoc documentation

**File**: Throughout codebase (focus on public APIs)
**Category**: Documentation
**Estimated Effort**: 2-3 days
**Status**: Open

**Current Issue**:
- Many public methods lack JSDoc
- Parameter types not documented
- Return values not explained
- No usage examples
- Hard for IDE to provide helpful hints

**Proposed Solution**:
Add JSDoc to all public methods with examples.

**Implementation Steps**:
1. Identify all public methods and exported functions
2. Add JSDoc with:
   - Description of what method does
   - @param entries for each parameter with type and description
   - @returns with type and description
   - @throws for error cases
   - @example with common usage pattern
   - @deprecated if applicable
3. Focus areas:
   - All builder setters (ZkapBuilder, BaseAccountBuilder)
   - All signer implementations
   - PaymasterService public methods
   - AccountKeyBuilder public methods
4. Review for consistency of tone and style

**Target Files**:
- lib/builders/*.ts (public methods)
- lib/signers/*.ts (public methods)
- lib/utils/PaymasterService.ts
- lib/utils/IUserOpSigner.ts

**Testing**:
- [ ] No TypeScript errors
- [ ] IDE shows helpful documentation on hover
- [ ] Examples are syntactically correct

---

### 4.2 Resolve TODO comments

**File**: Multiple
**Category**: Maintenance
**Estimated Effort**: Varies by TODO
**Status**: Open

**Current Issue**:
- Multiple TODO comments indicate incomplete work:
  - BaseAccountBuilder.ts:279 - Unverified functions need testing
  - PaymasterService.ts:57 - Backend API needs definition
  - PaymasterService.ts:179-195 - Gas limit calculation incomplete
  - ZkPasskeySigner.ts:61 - Naming needs update after simulator phase

**Proposed Solution**:
Either implement each TODO or create GitHub issue to track.

**Implementation Steps**:
For each TODO:
1. **BaseAccountBuilder:279** - Test all unverified gas estimation functions
   - Add unit tests for estimateUserOpGasCost, calculatePreVerificationGas, etc.
   - Verify against real EntryPoint calls if possible
   - Document any limitations or assumptions

2. **PaymasterService:57** - Define backend API spec
   - Document the actual API endpoints expected
   - Add comments with request/response examples
   - Coordinate with backend team on specification

3. **PaymasterService:179-195** - Implement proper gas limit calculation
   - Replace with actual ERC20 paymaster gas calculation
   - Test against real paymaster contracts
   - Document assumptions

4. **ZkPasskeySigner:61** - Rename after simulator phase
   - Review class name and method names
   - Update to reflect actual use case
   - Update comments to remove simulator references

**Testing**:
- [ ] Each TODO either implemented or has GitHub issue
- [ ] No orphaned TODOs remain
- [ ] Code review confirms implementations are correct

---

### 4.3 Remove or resolve TODO comments

**File**: `lib/builders/BaseAccountBuilder.ts:279`
**Category**: Code Maintenance
**Estimated Effort**: 1 hour (or longer if implementing verification)
**Status**: Open

**Current Issue**:
```typescript
// Line 279-280
// TODO: @kaikookim 여기 아래 함수들은 검증되지 않은 함수이므로, 테스트 후 사용해야 함
// estimateUserOpGasCost, calculatePreVerificationGas, estimateVerificationGas, estimateCallGas, estimatePaymasterGas, generateDummySignature
```
- Notes that 6 functions are unverified
- May have bugs or incorrect assumptions
- Marked as untested since function addition

**Proposed Solution**:
Either write verification tests or document limitations and expected accuracy range.

**Implementation Steps**:
1. Add unit tests for each function:
   - estimateUserOpGasCost()
   - calculatePreVerificationGas()
   - estimateVerificationGas()
   - estimateCallGas()
   - estimatePaymasterGas()
   - generateDummySignature()
2. Verify against real EntryPoint on testnet (if accessible)
3. Document accuracy expectations (±10%, ±5%, etc.)
4. Remove TODO and update comments to note verification status
5. Add @alpha or @experimental tags if still not fully verified

**Testing**:
- [ ] Each function has unit tests
- [ ] Tests verify reasonable outputs for various inputs
- [ ] Optionally: integration test against actual EntryPoint

---

## Summary by Timeline

### Recommended Implementation Order

**Week 1: Critical Security Fixes**
1. 1.2 - Validate private keys in AddressKeySigner (1 hour)
2. 1.5 - Add keyTypes to IUserOpSigner interface (30 min)
3. 2.2 - Validate addresses in setters (1.5 hours)
4. 1.3 - Make USDC address configurable (1 hour)

**Week 2: Gas Estimation Improvements**
1. 1.4 - Fix preVerificationGas hardcoding (2 hours)
2. 2.4 - Improve wallet creation gas estimate (2 hours)
3. 2.1 - Validate array lengths in setExecuteBatchCallData (1 hour)
4. 3.3 - Extract gas constants (1.5 hours)

**Week 3: Reliability & Caching**
1. 1.6 - Add JWKS caching (2-3 hours)
2. 2.3 - Improve error handling (2-3 hours)
3. 3.2 - Refactor PaymasterService duplication (1.5 hours)

**Week 4: Code Quality & Documentation**
1. 3.1 - Remove commented code (1 hour)
2. 3.4 - Extract array padding logic (1 hour)
3. 4.1 - Add JSDoc (as time permits)

**Later (Can defer):**
- 1.6 - Enable strictNullChecks (1-2 days, depends on fixes above)
- 3.5 - Type SwapBuilder.aggregator (1 hour)
- 3.6 - Implement sendTransaction (2-3 hours)
- 4.2 & 4.3 - Resolve TODO comments (varies)

---

## Quality Assurance Checklist

Before marking any task complete:

- [ ] Code compiles: `npx tsc --noEmit`
- [ ] Tests pass: `npm test`
- [ ] No new linting errors: `npm run lint` (if configured)
- [ ] Type safety verified with strict settings
- [ ] Changes don't break existing tests
- [ ] New tests added for new functionality
- [ ] Error messages are clear and actionable
- [ ] Documentation/JSDoc updated
- [ ] Git commit message is clear about what and why
- [ ] Backwards compatibility maintained (or breaking change noted)

---

## Dependencies & Blockers

- **1.6 (strictNullChecks)** depends on: 1.1, 2.2, other null-check fixes
- **Task ordering matters**: Do security fixes (Priority 1) before refactoring (Priority 3)
- **Testing**: All changes must maintain test coverage > 95%

---

## Notes for Development Team

1. **Async Operations**: Several improvements require async changes (e.g., JWKS caching). Test thoroughly for race conditions.

2. **Gas Constants**: The gas estimation constants (ADDRESS_KEY_VALIDATION_GAS, etc.) should be validated against actual measurements. Consider adding telemetry to track actual vs estimated.

3. **Hardcoded Values**: This codebase has several hardcoded addresses and values. Consider documenting a policy for configuration management (environment variables, contracts, etc.).

4. **Error Context**: When fixing error handling, ensure error messages help developers understand both WHAT went wrong and HOW to fix it.

5. **Testing Strategy**: Priority 1 items should have both unit tests and integration tests where applicable.

---

## Appendix: Estimated Effort Summary

| Priority | Category | Total Hours |
|----------|----------|------------|
| 1 (Critical) | Security & Correctness | ~10-12 hours |
| 2 (High) | Reliability | ~8-10 hours |
| 3 (Medium) | Maintainability | ~8-10 hours |
| 4 (Low) | Technical Debt | ~10+ hours |
| **TOTAL** | | **~36-42 hours (~1 month)** |

*Estimates include implementation, testing, and documentation.*
