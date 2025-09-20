/**
 * 單元測試環境
 * 提供輕量級的單元測試執行環境
 * 遵循 Five Lines 規則和單一責任原則
 *
 * @author TDD Phase 4 - cinnamon-refactor-owl重構設計師
 * @date 2025-08-25
 * @version v0.9.38-refactor
 */

/**
 * 單元測試環境
 * 管理單元測試的環境設置和清理
 */
class UnitTestEnvironment {
  constructor (config) {
    this._config = config
    this._initializeState()
  }

  /**
   * 初始化狀態
   */
  _initializeState () {
    this._isSetup = false
    this._mocks = new Map()
  }

  /**
   * 設置環境
   * @returns {Promise<void>}
   */
  async setup () {
    if (this._config.basicMocks) {
      this._setupBasicMocks()
    }

    if (this._config.jestMocks) {
      this._setupJestMocks()
    }

    this._isSetup = true
  }

  /**
   * 設置基本Mock
   */
  _setupBasicMocks () {
    this._setupConsoleLog()
    this._setupDateNow()
  }

  /**
   * 設置Console Log Mock
   */
  _setupConsoleLog () {
    // eslint-disable-next-line no-console
    const originalConsoleLog = console.log
    // eslint-disable-next-line no-console
    console.log = jest.fn()
    this._mocks.set('console.log', originalConsoleLog)
  }

  /**
   * 設置Date Now Mock
   */
  _setupDateNow () {
    const originalDateNow = Date.now
    Date.now = jest.fn(() => 1640995200000) // Fixed timestamp
    this._mocks.set('Date.now', originalDateNow)
  }

  /**
   * 設置Jest Mock
   */
  _setupJestMocks () {
    jest.clearAllMocks()
  }

  /**
   * 清理環境
   * @returns {Promise<void>}
   */
  async teardown () {
    this._restoreOriginalMethods()
    this._resetState()
  }

  /**
   * 還原原始方法
   */
  _restoreOriginalMethods () {
    this._mocks.forEach((original, path) => {
      this._restoreMethod(path, original)
    })
  }

  /**
   * 還原單一方法
   */
  _restoreMethod (path, original) {
    if (path === 'console.log') {
      // eslint-disable-next-line no-console
      console.log = original
    } else if (path === 'Date.now') {
      Date.now = original
    }
  }

  /**
   * 重置狀態
   */
  _resetState () {
    this._isSetup = false
    this._mocks.clear()
  }
}

module.exports = UnitTestEnvironment
