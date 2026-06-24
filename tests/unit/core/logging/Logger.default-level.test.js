/* eslint-disable no-console */

/**
 * Logger DEFAULT_LOG_LEVEL 環境感知測試
 *
 * Ticket: 1.4.2-W1-002
 *
 * 驗證 prod build 時 Logger 預設 level 為 WARN（抑制 INFO/DEBUG），
 * 非 prod 環境維持 INFO（向後相容）。
 */

describe('Logger DEFAULT_LOG_LEVEL (1.4.2-W1-002)', () => {
  const originalNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    jest.resetModules()
  })

  test('non-production 環境預設 level 為 INFO', () => {
    process.env.NODE_ENV = 'test'
    jest.resetModules()
    const { Logger } = require('../../../../src/core/logging/Logger')
    const logger = new Logger('Test')
    expect(logger.getLevel()).toBe('INFO')
  })

  test('production 環境預設 level 為 WARN', () => {
    process.env.NODE_ENV = 'production'
    jest.resetModules()
    const { Logger } = require('../../../../src/core/logging/Logger')
    const logger = new Logger('Test')
    expect(logger.getLevel()).toBe('WARN')
  })

  test('production 環境下 INFO 日誌不輸出', () => {
    process.env.NODE_ENV = 'production'
    jest.resetModules()
    const { Logger } = require('../../../../src/core/logging/Logger')
    const logger = new Logger('Test')
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {})
    logger.info('TEST_MESSAGE')
    expect(infoSpy).not.toHaveBeenCalled()
    infoSpy.mockRestore()
  })

  test('production 環境下 WARN 日誌正常輸出', () => {
    process.env.NODE_ENV = 'production'
    jest.resetModules()
    const { Logger } = require('../../../../src/core/logging/Logger')
    const logger = new Logger('Test')
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    logger.warn('TEST_WARNING')
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  test('明確指定 level 時覆蓋 DEFAULT_LOG_LEVEL', () => {
    process.env.NODE_ENV = 'production'
    jest.resetModules()
    const { Logger } = require('../../../../src/core/logging/Logger')
    const logger = new Logger('Test', 'DEBUG')
    expect(logger.getLevel()).toBe('DEBUG')
  })
})
