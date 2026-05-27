/* eslint-disable no-console */

/**
 * Logger constructor 第三參數（local MessageDictionary）測試
 *
 * Ticket: 0.19.0-W1-116
 *
 * 業務情境：
 * - W1-112 ANA 發現 Logger constructor 原本只接受 (name, level)，
 *   hardcoded this.messages = GlobalMessages，導致 popup / search-filter
 *   / validator 等 caller 傳入的 local dict（第三參數）被 JS 靜默 ignore。
 * - W1-115 修復 constructor signature 為 (name, level, messages = GlobalMessages)。
 * - 本測試補強 false positive 覆蓋缺口：驗證第三參數注入後
 *   this.messages 確實指向 local dict，logger 輸出採 local dict 文字。
 *
 * 驗收條件覆蓋（W1-116 AC 1）：
 * - AC 1: 第三參數注入後 logger.messages === 注入物件（不是 GlobalMessages）
 * - AC 2: logger 輸出採 local dict 文字（messageKey 在 local dict 內）
 * - AC 3: local dict 缺 key 時降級為 GlobalMessages 行為（[Missing: KEY] 字串）
 * - AC 4: 第三參數預設值為 GlobalMessages（向後相容）
 */

const { Logger } = require('../../../../src/core/logging/Logger')
const { MessageDictionary, GlobalMessages } = require('../../../../src/core/messages/MessageDictionary')

describe('Logger constructor local dict 注入 (0.19.0-W1-116)', () => {
  let infoSpy
  let warnSpy

  beforeEach(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {})
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    infoSpy.mockRestore()
    warnSpy.mockRestore()
  })

  describe('AC 1: 第三參數注入時 this.messages 指向 local dict', () => {
    it('傳入 MessageDictionary 實例時 this.messages 為該實例（非 GlobalMessages）', () => {
      const localDict = new MessageDictionary({
        TEST_LOCAL_KEY: 'Local 訊息內容'
      })
      const logger = new Logger('LocalDictTest', 'INFO', localDict)

      expect(logger.messages).toBe(localDict)
      expect(logger.messages).not.toBe(GlobalMessages)
    })

    it('未傳第三參數時 this.messages 預設為 GlobalMessages（向後相容）', () => {
      const logger = new Logger('DefaultTest', 'INFO')
      expect(logger.messages).toBe(GlobalMessages)
    })

    it('傳入 plain object 作為訊息字典時也應正確指派至 this.messages', () => {
      // 業務情境：caller 可能直接傳 plain dict 而非 MessageDictionary 實例
      // 只要該物件有 get(key, params) 方法即可被 Logger 使用
      const plainDict = {
        get: (key) => `plain-${key}`
      }
      const logger = new Logger('PlainDictTest', 'INFO', plainDict)
      expect(logger.messages).toBe(plainDict)
    })
  })

  describe('AC 2: logger 輸出採 local dict 文字', () => {
    it('local dict 含 messageKey 時輸出採 local dict 內容（非 GlobalMessages）', () => {
      const localDict = new MessageDictionary({
        CUSTOM_LOAD_EVENT: '🎯 自訂載入事件訊息'
      })
      const logger = new Logger('CustomLogger', 'INFO', localDict)

      logger.info('CUSTOM_LOAD_EVENT')

      expect(infoSpy).toHaveBeenCalledTimes(1)
      const output = infoSpy.mock.calls[0][0]
      expect(typeof output).toBe('string')
      expect(output).toContain('🎯 自訂載入事件訊息')
      expect(output).toContain('CUSTOM_LOAD_EVENT')
      // 確認非 GlobalMessages 預設值（GlobalMessages 沒有此 key）
      expect(output).not.toContain('[Missing: CUSTOM_LOAD_EVENT]')
    })

    it('local dict 覆寫 GlobalMessages 同名 key 時採 local dict 文字', () => {
      // 業務情境：local dict 可重新定義 GlobalMessages 既有 key 以提供模組專屬語意
      // POPUP_INTERFACE_LOADED 在 GlobalMessages 為 'Popup 介面已載入'
      const localDict = new MessageDictionary({
        POPUP_INTERFACE_LOADED: '🎨 Popup 自訂載入文字'
      })
      const logger = new Logger('OverrideTest', 'INFO', localDict)

      logger.info('POPUP_INTERFACE_LOADED')

      const output = infoSpy.mock.calls[0][0]
      expect(output).toContain('🎨 Popup 自訂載入文字')
      // 確認沒有採用 GlobalMessages 預設文字
      expect(output).not.toContain('Popup 介面已載入')
    })

    it('local dict 訊息含 {param} 模板時應正確替換', () => {
      const localDict = new MessageDictionary({
        BOOKS_DATA_UPDATED: '已更新 {count} 本書籍'
      })
      const logger = new Logger('TemplateTest', 'INFO', localDict)

      logger.info('BOOKS_DATA_UPDATED', { count: 42 })

      const output = infoSpy.mock.calls[0][0]
      expect(output).toContain('已更新 42 本書籍')
    })
  })

  describe('AC 3: local dict 缺 key 的降級行為', () => {
    it('local dict 沒有 key 時 MessageDictionary 回傳 [Missing: KEY]', () => {
      // 業務情境：MessageDictionary 對未註冊 key 的標準回應是 [Missing: KEY]
      // 此即 W1-001.2 觀察到的線索文字
      const localDict = new MessageDictionary({
        ONLY_THIS_KEY: '唯一存在的訊息'
      })
      const logger = new Logger('MissingKeyTest', 'INFO', localDict)

      logger.info('UNREGISTERED_KEY')

      const output = infoSpy.mock.calls[0][0]
      expect(output).toContain('[Missing: UNREGISTERED_KEY]')
    })
  })

  describe('AC 4: 三參數注入不影響其他 Logger 行為', () => {
    it('注入 local dict 後 setLevel / getLevel 行為不變', () => {
      const localDict = new MessageDictionary({ FOO: 'foo' })
      const logger = new Logger('LevelTest', 'INFO', localDict)

      expect(logger.getLevel()).toBe('INFO')
      logger.setLevel('DEBUG')
      expect(logger.getLevel()).toBe('DEBUG')
      // local dict 仍指向同一物件
      expect(logger.messages).toBe(localDict)
    })

    it('注入 local dict 後 buffer 機制仍正常運作', () => {
      const localDict = new MessageDictionary({ BUFFERED_MSG: '緩衝訊息' })
      const logger = new Logger('BufferTest', 'DEBUG', localDict)

      logger.info('BUFFERED_MSG')
      const buffer = logger.getBuffer()
      expect(buffer).toHaveLength(1)
      expect(buffer[0].messageKey).toBe('BUFFERED_MSG')
      expect(buffer[0].message).toBe('緩衝訊息')
    })
  })
})
