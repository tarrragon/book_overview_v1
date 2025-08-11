/**
 * Jest 測試框架配置檔案
 *
 * Responsible for:
 * - 配置測試環境和執行設定
 * - 定義測試檔案匹配規則
 * - 設定程式碼覆蓋率收集
 * - 配置模組路徑映射
 *
 * Design considerations:
 * - 支援多種測試環境（JSDOM for UI, Node for background scripts）
 * - 提供詳細的覆蓋率報告
 * - 優化測試執行效能
 *
 * Process flow:
 * 1. 載入基礎配置
 * 2. 設定測試環境
 * 3. 配置模組解析
 * 4. 定義測試匹配規則
 * 5. 設定覆蓋率收集
 */

module.exports = {
  // 測試環境配置
  testEnvironment: 'jsdom',

  // 測試環境選項
  testEnvironmentOptions: {
    url: 'https://readmoo.com',
    userAgent: 'Mozilla/5.0 Chrome Extension Test'
  },

  // 設定檔案
  setupFilesAfterEnv: [
    '<rootDir>/tests/test-setup.js'
  ],

  // 測試檔案匹配規則
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js',
    '<rootDir>/tests/integration/**/*.test.js',
    '<rootDir>/tests/e2e/**/*.test.js'
  ],

  // 測試檔案忽略規則
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/build/',
    '<rootDir>/docs/'
  ],

  // 模組名稱映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@mocks/(.*)$': '<rootDir>/tests/mocks/$1',
    '^@fixtures/(.*)$': '<rootDir>/tests/fixtures/$1'
  },

  // 模組檔案副檔名
  moduleFileExtensions: [
    'js',
    'json',
    'html',
    'css'
  ],

  // 轉換配置（簡化版本）
  // transform: {
  //   '^.+\\.js$': 'babel-jest',
  //   '^.+\\.html$': '<rootDir>/tests/transforms/html-transform.js',
  //   '^.+\\.css$': '<rootDir>/tests/transforms/css-transform.js'
  // },

  // 轉換忽略規則
  transformIgnorePatterns: [
    'node_modules/(?!(jest-chrome)/)'
  ],

  // 覆蓋率收集
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.config.js',
    '!src/**/index.js',
    '!src/assets/**',
    '!src/**/*.min.js'
  ],

  // 覆蓋率閾值
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/background/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/storage/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },

  // 覆蓋率目錄
  coverageDirectory: 'coverage',

  // 覆蓋率報告格式
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json'
  ],

  // 測試執行設定
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  maxWorkers: '50%',

  // 全域設定
  globals: {
    chrome: {},
    browser: {},
    NODE_ENV: 'test'
  },

  // 測試結果處理器（暫時註解掉以簡化配置）
  // testResultsProcessor: '<rootDir>/tests/processors/test-results-processor.js',

  // 監視插件（暫時註解掉以簡化配置）
  // watchPlugins: [
  //   'jest-watch-typeahead/filename',
  //   'jest-watch-typeahead/testname'
  // ],

  // 快照序列化器（暫時註解掉以簡化配置）
  // snapshotSerializers: [
  //   '<rootDir>/tests/serializers/html-element-serializer.js'
  // ],

  // 測試套件配置（暫時簡化）
  // projects: [
  //   {
  //     displayName: 'Unit Tests',
  //     testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
  //     testEnvironment: 'jsdom'
  //   },
  //   {
  //     displayName: 'Integration Tests',
  //     testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
  //     testEnvironment: 'jsdom'
  //   },
  //   {
  //     displayName: 'Background Scripts Tests',
  //     testMatch: ['<rootDir>/tests/unit/background/**/*.test.js'],
  //     testEnvironment: 'node'
  //   },
  //   {
  //     displayName: 'E2E Tests',
  //     testMatch: ['<rootDir>/tests/e2e/**/*.test.js'],
  //     testEnvironment: 'node',
  //     runner: '@jest-runner/electron'
  //   }
  // ],

  // 錯誤處理
  errorOnDeprecated: true,
  bail: false,

  // 快取設定
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',

  // 清理選項
  clearMocks: true,
  restoreMocks: true,
  resetMocks: false
}
