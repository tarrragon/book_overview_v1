/**
 * Jest E2E 測試專用配置
 *
 * 關鍵差異：
 * - testEnvironment: 'node'（Puppeteer 操作真實瀏覽器，不能用 jsdom）
 * - 不載入 test-setup.js（避免 jest-chrome / DOM 相關 mock）
 * - testTimeout 設為 30 秒（E2E 測試需要較長執行時間）
 * - testMatch 僅匹配 tests/e2e/ 目錄
 */

module.exports = {
  testEnvironment: 'node',

  testMatch: [
    '<rootDir>/tests/e2e/**/*.test.js'
  ],

  // 不載入 test-setup.js — E2E 不需要 jsdom mock
  // setupFilesAfterEnv: [],

  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@mocks/(.*)$': '<rootDir>/tests/mocks/$1',
    '^@fixtures/(.*)$': '<rootDir>/tests/fixtures/$1'
  },

  transform: {
    '^.+\\.js$': 'babel-jest'
  },

  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/build/'
  ],

  testTimeout: 30000,
  verbose: true
}
