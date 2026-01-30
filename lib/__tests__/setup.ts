/**
 * Jest 전역 Setup 파일
 * 모든 테스트 전에 실행됨
 */

// fetch가 없는 Node 버전을 위한 polyfill
// Node 18+에서는 자동으로 있음
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn();
}

// 전역 mock 리셋
beforeEach(() => {
  jest.clearAllMocks();
});

// 테스트 타임아웃 설정 (crypto 연산이 느릴 수 있음)
jest.setTimeout(10000);

// console.error/warn 을 테스트에서 캡처하려면 아래 주석 해제
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
