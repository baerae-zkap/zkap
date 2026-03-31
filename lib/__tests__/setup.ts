/**
 * Jest global setup file
 * Runs before all tests
 */

// Polyfill for Node versions that do not have fetch
// Available automatically in Node 18+
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn();
}

// Reset global mocks
beforeEach(() => {
  jest.clearAllMocks();
});

// Set test timeout (crypto operations can be slow)
jest.setTimeout(10000);

// Uncomment below to capture console.error/warn in tests
// const originalConsoleError = console.error;
// const originalConsoleWarn = console.warn;
//
// beforeAll(() => {
//   console.error = jest.fn();
//   console.warn = jest.fn();
// });
//
// afterAll(() => {
//   console.error = originalConsoleError;
//   console.warn = originalConsoleWarn;
// });
