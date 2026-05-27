/**
 * MessageDictionary constructor union signature 單元測試
 *
 * 對應 Ticket: 0.19.0-W1-105
 *
 * 測試目標：
 * - 驗證 constructor 接受 string 型 language（向後相容）
 * - 驗證 constructor 接受 object 型初始 messages 並正確註冊
 * - 驗證 dict.get(customKey) 對自訂 messages 不再回傳 [Missing: ...] 佔位符
 * - 驗證 constructor 對空物件、無參數的邊界行為
 *
 * 設計考量：
 * - 不 mock Logger / ErrorCodes，使用真實模組驗證註冊鏈路完整
 * - 涵蓋 Solution「測試策略」表格 5 個 test case，逐一對應 acceptance
 */

const { MessageDictionary } = require('src/core/messages/MessageDictionary')

describe('MessageDictionary constructor union signature', () => {
  describe('向後相容：String / 無參數路徑', () => {
    test('無參數時，messages 含預設值且 language=zh-TW', () => {
      const dict = new MessageDictionary()

      expect(dict.language).toBe('zh-TW')
      // 預設訊息存在
      expect(dict.has('VALIDATION_FAILED')).toBe(true)
      expect(dict.get('VALIDATION_FAILED')).toBe('資料驗證失敗')
      // 預設 cache size 已初始化
      expect(typeof dict._cacheSize).toBe('number')
      expect(dict._cacheSize).toBeGreaterThan(0)
    })

    test("字串參數 'en-US' 時，messages 含預設值且 language=en-US", () => {
      const dict = new MessageDictionary('en-US')

      expect(dict.language).toBe('en-US')
      // 預設訊息仍存在（目前無實際語言分流）
      expect(dict.has('VALIDATION_FAILED')).toBe(true)
      expect(dict.get('VALIDATION_FAILED')).toBe('資料驗證失敗')
    })
  })

  describe('Object 路徑：批次註冊自訂 messages', () => {
    test('物件參數時，messages 含預設值 + 自訂 key 且 language=zh-TW', () => {
      const dict = new MessageDictionary({
        CUSTOM_KEY: '自訂訊息',
        ANOTHER_KEY: '另一個訊息'
      })

      // 預設 language
      expect(dict.language).toBe('zh-TW')
      // 預設訊息仍存在
      expect(dict.has('VALIDATION_FAILED')).toBe(true)
      // 自訂訊息已註冊
      expect(dict.has('CUSTOM_KEY')).toBe(true)
      expect(dict.get('CUSTOM_KEY')).toBe('自訂訊息')
      expect(dict.has('ANOTHER_KEY')).toBe(true)
      expect(dict.get('ANOTHER_KEY')).toBe('另一個訊息')
    })

    test('20+ 自訂 keys 物件時，dict.get(customKey) 正確回傳 value 不為 [Missing: ...]', () => {
      // 模擬 popup.js / book-search-filter / validator 三個 caller 的真實場景
      const customMessages = {
        POPUP_LOGGER_INIT: 'Popup logger 初始化',
        POPUP_BUTTON_CLICKED: '按鈕已點擊',
        POPUP_TAB_SWITCHED: '分頁已切換',
        SEARCH_FILTER_APPLIED: '搜尋條件已套用',
        SEARCH_FILTER_CLEARED: '搜尋條件已清除',
        SEARCH_FILTER_FAILED: '搜尋條件套用失敗',
        SEARCH_INDEX_BUILT: '搜尋索引已建立',
        VALIDATOR_PLATFORM_DETECTED: '已偵測平台',
        VALIDATOR_DATA_INTACT: '資料完整',
        VALIDATOR_DATA_CORRUPTED: '資料損毀',
        VALIDATOR_MIGRATION_START: '開始遷移',
        VALIDATOR_MIGRATION_DONE: '遷移完成',
        EXTRA_KEY_01: 'extra 1',
        EXTRA_KEY_02: 'extra 2',
        EXTRA_KEY_03: 'extra 3',
        EXTRA_KEY_04: 'extra 4',
        EXTRA_KEY_05: 'extra 5',
        EXTRA_KEY_06: 'extra 6',
        EXTRA_KEY_07: 'extra 7',
        EXTRA_KEY_08: 'extra 8'
      }
      const dict = new MessageDictionary(customMessages)

      // 全部自訂 key 應正確回傳，不可有任何 [Missing: ...] 佔位符
      Object.keys(customMessages).forEach((key) => {
        const value = dict.get(key)
        expect(value).toBe(customMessages[key])
        expect(value).not.toMatch(/^\[Missing:/)
      })

      // 預設訊息也應保留
      expect(dict.get('VALIDATION_FAILED')).toBe('資料驗證失敗')
    })

    test('空物件時不拋錯，行為等同無參數（預設訊息存在）', () => {
      let dict
      expect(() => {
        dict = new MessageDictionary({})
      }).not.toThrow()

      expect(dict.language).toBe('zh-TW')
      // 預設訊息存在
      expect(dict.has('VALIDATION_FAILED')).toBe(true)
      // 自訂訊息為空，未知 key 仍回 Missing 佔位符
      expect(dict.get('NON_EXISTENT_KEY')).toBe('[Missing: NON_EXISTENT_KEY]')
    })
  })
})
