/**
 * Jest 效能測試專用配置
 *
 * 設定：
 * - 使用 Node.js 環境（避免 DOM 依賴）
 * - 自訂模組對應
 * - 無 test-setup.js（避免 window 相關設定）
 */

module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/performance/**/*.test.js'
  ],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/../../src/$1',
    '^@/(.*)$': '<rootDir>/../../src/$1',
    '^@tests/(.*)$': '<rootDir>/../../tests/$1',
    '^@mocks/(.*)$': '<rootDir>/../../tests/mocks/$1',
    '^@fixtures/(.*)$': '<rootDir>/../../tests/fixtures/$1'
  },
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.config.js',
    '!src/**/index.js'
  ],
  coverageDirectory: 'coverage/performance',
  testTimeout: 120000, // 2 分鐘超時
  verbose: true
}