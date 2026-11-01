/*
 * NO JEST HERE. ok-edge's jest suites were removed (45a53f7: nothing ran them); app logic worth testing lives in the
 * lib's `npm test`, and the app is checked with `npx tsc --noEmit -p .` and the drive. A bare `npx jest` fetched jest
 * and ran it over mcp-server's node:test files, which reads as a failure that is not one (Brad, 2026-10-31: "put a
 * empty jest file in place, to pass with no jest tests"): this matches no file and passes saying so.
 */
module.exports = {
  /* src only: crawling dist/ found the packaged emulator twice and warned about it */
  roots: ['<rootDir>/src'],
  testMatch: ['<rootDir>/no-jest-tests/**'],
  passWithNoTests: true,
};
