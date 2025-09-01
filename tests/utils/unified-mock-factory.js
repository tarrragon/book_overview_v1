/**
 * UnifiedMockFactory - 統一 Mock 建立工廠
 *
 * 負責功能：
 * - 統一各種 Mock 物件建立
 * - 減少測試間重複程式碼
 * - 提供一致的 Mock 介面
 *
 * 設計考量：
 * - 遵循 Five Lines 規則
 * - 單一責任原則：只負責建立 Mock
 * - 測試專用工具
 */

class UnifiedMockFactory {
  /**
   * 建立 FileReader Mock
   * @param {Object} options - Mock 選項
   * @returns {Object} FileReader Mock
   */
  static createFileReaderMock (options = {}) {
    const mock = { onload: null, onerror: null, result: null }
    mock.readAsText = options.readAsText || jest.fn()
    return mock
  }

  /**
   * 建立 Chrome API Mock
   * @param {Array<string>} apis - 需要 Mock 的 API 列表
   * @returns {Object} Chrome API Mock
   */
  static createChromeApiMock (apis = []) {
    const mock = {}
    apis.forEach(api => { mock[api] = jest.fn() })
    return mock
  }
}

module.exports = UnifiedMockFactory
