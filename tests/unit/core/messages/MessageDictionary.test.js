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

const { MessageDictionary, GlobalMessages } = require('src/core/messages/MessageDictionary')

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

  /**
   * W1-109：清理 _loadDefaultMessages module-specific keys 後，
   *        驗證合格跨模組共用 keys 仍可取得，且 module-specific keys
   *        已從 GlobalMessages 移除（各 caller 由 local dict 接管）。
   *
   * 對應 W1-107 Solution「合格 GlobalMessages key 清單」(~20 keys) + 中文 legacy 3。
   */
  describe('W1-109: GlobalMessages 清理後的作用域邊界', () => {
    const SHARED_KEYS = {
      // 錯誤類 (5)
      VALIDATION_FAILED: '資料驗證失敗',
      NETWORK_ERROR: '網路連線異常',
      STORAGE_ERROR: '儲存操作失敗',
      PERMISSION_DENIED: '權限不足',
      UNKNOWN_ERROR: '未知錯誤',
      // 操作類 (5)
      OPERATION_START: '開始執行操作',
      OPERATION_COMPLETE: '操作完成',
      OPERATION_CANCELLED: '操作已取消',
      OPERATION_TIMEOUT: '操作逾時',
      OPERATION_RETRY: '重試操作',
      // 系統類 (4)
      SYSTEM_READY: '系統準備就緒',
      SYSTEM_SHUTDOWN: '系統正在關閉',
      LOADING: '載入中...',
      PROCESSING: '處理中...',
      // 通用 UI (5)
      SUCCESS: '成功',
      FAILED: '失敗',
      RETRY: '重試',
      CANCEL: '取消',
      CONFIRM: '確認',
      // 測試專用 (2)
      TEST_MESSAGE: '測試訊息',
      TEST_WITH_PARAMS: '測試參數: {param1} 和 {param2}'
    }

    const LEGACY_CHINESE_KEYS = {
      // 中文 legacy keys：仍有 caller 直接以中文字面 logger.warn('未知的篩選條件', {...})
      // 呼叫，且該 caller 未注入 local dict（filter-engine / search-engine /
      // platform-detection-service）。移除會導致 [Missing: ...] runtime 失效。
      // 暫保留至各 caller 建立 local dict 後再清理（W1-109 不在範圍）。
      未知的篩選條件: '未知的篩選條件',
      '索引搜尋失敗，回退到線性搜尋': '索引搜尋失敗，回退到線性搜尋',
      'Event listener registration failed': '事件監聽器註冊失敗'
    }

    const REMOVED_KEYS = [
      // 書庫類 (5) — 無 caller
      'BOOK_EXTRACTION_START',
      'BOOK_EXTRACTION_COMPLETE',
      'BOOK_COUNT',
      'BOOK_PROGRESS_UPDATE',
      'BOOK_VALIDATION_FAILED',
      // Chrome ext (4) — 無 caller
      'EXTENSION_READY',
      'CONTENT_SCRIPT_LOADED',
      'POPUP_OPENED',
      'BACKGROUND_SCRIPT_ACTIVE',
      // 日誌類 (4) — 無 caller（Logger fallback 內含 inline，不需 dict）
      'DEBUG_MESSAGE',
      'INFO_MESSAGE',
      'WARN_MESSAGE',
      'ERROR_MESSAGE',
      // validator (14) — validatorMessages local dict 已覆蓋
      'VALIDATOR_INIT',
      'VALIDATION_START',
      'VALIDATION_SUCCESS',
      'VALIDATION_TIMEOUT',
      'VALIDATION_RETRY',
      'VALIDATION_CACHE_HIT',
      'DATA_EXTRACTION_START',
      'DATA_EXTRACTION_EMPTY',
      'DATA_VALIDATION_FAILED',
      'PLATFORM_DETECTION_START',
      'PLATFORM_CONFIDENCE_LOW',
      'ERROR_CATEGORIZED',
      'EVENT_SYSTEM_START',
      'EVENT_EMIT_FAILED',
      // search-filter (9) — searchUIMessages local dict 已覆蓋
      'COMPONENT_INIT',
      'CLEANUP_SUCCESS',
      'CACHE_CLEANUP',
      'MODULAR_COMPONENTS_SUCCESS',
      'SEARCH_CLEARED',
      'SEARCH_EXECUTION_ERROR',
      'FILTER_APPLICATION_ERROR',
      'BOOKS_DATA_UPDATED',
      'BOOKS_DATA_UPDATE_WARNING',
      // extractor (19) — readmooAdapterMessages local dict 已覆蓋
      'DATA_EXTRACTION_COMPLETE',
      'BOOK_CONTAINERS_FOUND',
      'BOOK_CONTAINERS_PARSE_FAILED',
      'BOOK_BATCH_PARSE_FAILED',
      'NO_BOOK_ELEMENTS_FOUND',
      'GET_BOOK_ELEMENTS_CALLED',
      'WAIT_FOR_BOOK_ELEMENTS_START',
      'WAIT_FOR_BOOK_ELEMENTS_FOUND',
      'WAIT_FOR_BOOK_ELEMENTS_SKIP',
      'WAIT_FOR_BOOK_ELEMENTS_TIMEOUT',
      'SELECTOR_PARADOX',
      'CONTAINER_SAMPLE',
      'EXTRACTION_SAMPLE_DATA',
      'FALLBACK_SELECTOR_SUCCESS',
      'FALLBACK_SELECTOR_ATTEMPT',
      'LAST_RESORT_STRATEGY',
      'UNSAFE_COVER_URL_FILTERED',
      'PLACEHOLDER_URL_REPLACED',
      'EXTRACTION_COMPLETED',
      // 配置 (1) — validator local dict 已覆蓋
      'CONFIG_VALIDATION_FAILED'
    ]

    test('合格的 21 個跨模組共用 key 仍可從 GlobalMessages 取得且文字正確', () => {
      const dict = new MessageDictionary()
      Object.entries(SHARED_KEYS).forEach(([key, expectedText]) => {
        expect(dict.has(key)).toBe(true)
        expect(dict.get(key)).toBe(expectedText)
      })
    })

    test('中文 legacy keys 暫保留（caller 尚未注入 local dict）', () => {
      const dict = new MessageDictionary()
      Object.entries(LEGACY_CHINESE_KEYS).forEach(([key, expectedText]) => {
        expect(dict.has(key)).toBe(true)
        expect(dict.get(key)).toBe(expectedText)
      })
    })

    test('TEST_WITH_PARAMS 參數替換維持正確', () => {
      const dict = new MessageDictionary()
      expect(dict.get('TEST_WITH_PARAMS', { param1: 'A', param2: 'B' })).toBe('測試參數: A 和 B')
    })

    test('已移除的 ~56 個 module-specific keys 不再存在於 GlobalMessages', () => {
      const dict = new MessageDictionary()
      REMOVED_KEYS.forEach((key) => {
        expect(dict.has(key)).toBe(false)
        expect(dict.get(key)).toBe(`[Missing: ${key}]`)
      })
    })

    test('GlobalMessages 預設 key 數收斂在 24 ± 2 範圍（21 共用 + 3 中文 legacy）', () => {
      const dict = new MessageDictionary()
      const keyCount = dict.keys().length
      // 上下界容忍：避免微小調整（新增 1-2 共用 key）即破壞測試
      expect(keyCount).toBeGreaterThanOrEqual(22)
      expect(keyCount).toBeLessThanOrEqual(26)
    })
  })

  /**
   * W1-110：GlobalMessages.messages 物理 freeze 防護
   *
   * 對應 W1-107 議題 B 方案 3 結論 + W1-110 acceptance：
   * - GlobalMessages 建立後其 messages 物件已 Object.freeze
   * - 嘗試 GlobalMessages.set / addMessages / 直接賦值 / delete 應拋 TypeError（strict mode）
   *
   * 設計考量：
   * - 測試檔頂層為 CommonJS require，預設 sloppy mode；ES Module source 內為 strict。
   * - 為確保拋錯行為，將寫入操作包進 'use strict' IIFE，模擬 source 端的 strict 環境。
   * - 同時驗證 local dict 實例（new MessageDictionary({...})）未受影響，可正常寫入。
   */
  describe('W1-110: GlobalMessages.messages 物理 freeze 防護', () => {
    test('GlobalMessages.messages 已被 Object.freeze', () => {
      expect(Object.isFrozen(GlobalMessages.messages)).toBe(true)
    })

    test('strict mode 下對 GlobalMessages.messages 直接賦值新 key 應拋 TypeError', () => {
      expect(() => {
        'use strict'
        GlobalMessages.messages.W1_110_NEW_KEY = 'should fail'
      }).toThrow(TypeError)
    })

    test('strict mode 下覆寫既有 key 應拋 TypeError', () => {
      expect(() => {
        'use strict'
        GlobalMessages.messages.SUCCESS = 'overridden'
      }).toThrow(TypeError)
    })

    test('strict mode 下 delete GlobalMessages.messages 既有 key 應拋 TypeError', () => {
      expect(() => {
        'use strict'
        delete GlobalMessages.messages.SUCCESS
      }).toThrow(TypeError)
    })

    test('GlobalMessages.set 對既有 key 寫入應拋 TypeError（freeze 阻擋）', () => {
      // 内部 this.messages[key] = message 在 strict caller 下會拋 TypeError
      expect(() => {
        GlobalMessages.set('SUCCESS', 'overridden via set')
      }).toThrow(TypeError)
    })

    test('GlobalMessages.set 對新 key 寫入應拋 TypeError（freeze 阻擋）', () => {
      expect(() => {
        GlobalMessages.set('W1_110_VIA_SET', 'should fail')
      }).toThrow(TypeError)
    })

    test('GlobalMessages.addMessages 寫入應拋 TypeError（freeze 阻擋 Object.assign）', () => {
      expect(() => {
        GlobalMessages.addMessages({ W1_110_VIA_ADD: 'should fail' })
      }).toThrow(TypeError)
    })

    test('GlobalMessages 既有 key 仍可正常讀取（freeze 只阻寫不阻讀）', () => {
      expect(GlobalMessages.get('SUCCESS')).toBe('成功')
      expect(GlobalMessages.get('VALIDATION_FAILED')).toBe('資料驗證失敗')
      expect(GlobalMessages.has('SUCCESS')).toBe(true)
    })

    test('local dict 實例的 messages 未被 freeze（不影響非全域實例）', () => {
      const localDict = new MessageDictionary({ INITIAL_KEY: 'initial' })
      expect(Object.isFrozen(localDict.messages)).toBe(false)
      // 可正常透過 set 寫入
      expect(() => {
        localDict.set('LOCAL_NEW_KEY', 'local value')
      }).not.toThrow()
      expect(localDict.get('LOCAL_NEW_KEY')).toBe('local value')
    })
  })
})
