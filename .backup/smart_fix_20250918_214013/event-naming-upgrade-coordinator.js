/**
 * EventNamingUpgradeCoordinator - 事件命名升級協調器
 * 負責 v1.x → v2.0 事件轉換和雙軌並行處理
 *
 * 負責功能：
 * - v1.x → v2.0 事件轉換
 * - 雙向事件支援 (Legacy + Modern)
 * - 轉換統計與監控
 * - 漸進式升級控制
 *
 * 設計考量：
 * - 100% 向後相容性保證
 * - 漸進式升級支援
 * - 智能事件名稱推斷
 * - 完整的錯誤處理和統計
 *
 * 處理流程：
 * 1. 註冊雙軌事件監聽器，同時支援 Legacy 和 Modern 格式
 * 2. 智能轉換事件名稱，自動推斷領域和平台
 * 3. 記錄轉換統計，監控升級進度
 * 4. 提供錯誤處理和回滾機制
 *
 * 使用情境：
 * - 事件系統 v2.0 升級過程中的無縫遷移
 * - 確保現有 Readmoo 功能完全不受影響
 * - 為後續多平台支援奠定基礎
 */

/**
 * Legacy → Modern 事件轉換對應表
 * 基於策略文件中定義的標準轉換規則
 */
const { StandardError } = require('src/core/errors/StandardError')

const EVENT_MIGRATION_MAPPING = {
  // Readmoo 平台核心事件
  'EXTRACTION.COMPLETED': 'EXTRACTION.READMOO.EXTRACT.COMPLETED',
  'EXTRACTION.PROGRESS': 'EXTRACTION.READMOO.EXTRACT.PROGRESS',
  'EXTRACTION.STARTED': 'EXTRACTION.READMOO.EXTRACT.STARTED',
  'EXTRACTION.FAILED': 'EXTRACTION.READMOO.EXTRACT.FAILED',
  'EXTRACTION.DATA.COMPLETED': 'EXTRACTION.READMOO.DATA.COMPLETED',

  // 儲存相關事件
  'STORAGE.SAVE.COMPLETED': 'DATA.READMOO.SAVE.COMPLETED',
  'STORAGE.SAVE.REQUESTED': 'DATA.READMOO.SAVE.REQUESTED',
  'STORAGE.LOAD.COMPLETED': 'DATA.READMOO.LOAD.COMPLETED',
  'STORAGE.LOAD.REQUESTED': 'DATA.READMOO.LOAD.REQUESTED',

  // UI 相關事件
  'UI.POPUP.OPENED': 'UX.GENERIC.OPEN.COMPLETED',
  'UI.POPUP.CLOSED': 'UX.GENERIC.CLOSE.COMPLETED',
  'UI.OVERVIEW.RENDERED': 'UX.GENERIC.RENDER.COMPLETED',

  // 背景服務事件
  'BACKGROUND.INIT.COMPLETED': 'SYSTEM.GENERIC.INIT.COMPLETED',
  'CONTENT.EVENT.FORWARD': 'MESSAGING.READMOO.FORWARD.COMPLETED',

  // 診斷監控事件
  'DIAGNOSTIC.STATUS.UPDATE': 'SYSTEM.GENERIC.UPDATE.COMPLETED',
  'ERROR.HANDLING.TRIGGERED': 'SYSTEM.GENERIC.ERROR.TRIGGERED',

  // 平台管理事件
  'PLATFORM.DETECTION.COMPLETED': 'PLATFORM.READMOO.DETECT.COMPLETED',
  'PLATFORM.SWITCH.REQUESTED': 'PLATFORM.READMOO.SWITCH.REQUESTED'
}

/**
 * Modern → Legacy 反向轉換對應表
 */
const MODERN_TO_LEGACY_MAPPING = Object.fromEntries(
  Object.entries(EVENT_MIGRATION_MAPPING).map(([legacy, modern]) => [modern, legacy])
)

/**
 * 有效的轉換模式
 */
const CONVERSION_MODES = {
  DUAL_TRACK: 'DUAL_TRACK', // 雙軌並行模式
  MODERN_ONLY: 'MODERN_ONLY', // 純現代模式
  LEGACY_ONLY: 'LEGACY_ONLY' // 純傳統模式（緊急模式）
}

class EventNamingUpgradeCoordinator {
  constructor (eventBus) {
    this.eventBus = eventBus
    this.conversionMode = CONVERSION_MODES.DUAL_TRACK
    this.conversionMap = EVENT_MIGRATION_MAPPING
    this.modernToLegacyMap = MODERN_TO_LEGACY_MAPPING
    this.modernEventRegistry = new Set()
    this.conversionStats = this.initializeStats()
  }

  /**
   * 初始化轉換統計
   * @returns {Object} 統計對象
   */
  initializeStats () {
    return {
      totalConversions: 0,
      legacyTriggered: 0,
      modernTriggered: 0,
      conversionErrors: 0,
      startTime: Date.now()
    }
  }

  /**
   * 註冊雙軌事件監聽器 - 同時支援 Legacy 和 Modern 事件
   * @param {string} legacyEvent - 舊版事件名稱
   * @param {Function} handler - 事件處理器
   */
  registerDualTrackListener (legacyEvent, handler) {
    const modernEvent = this.convertToModernEvent(legacyEvent)

    // 註冊 Legacy 事件監聽器
    this.eventBus.on(legacyEvent, async (data) => {
      this.recordConversion(legacyEvent, 'LEGACY_TRIGGERED')
      try {
        // 為 handler 提供包含事件類型的物件
        const eventObject = {
          type: legacyEvent,
          data,
          timestamp: Date.now(),
          isLegacy: true
        }
        await handler(eventObject)
      } catch (error) {
        this.recordConversionError('HANDLER_ERROR', error.message)
      }

      // 同時觸發 Modern 事件
      await this.eventBus.emit(modernEvent, data)
    })

    // 註冊 Modern 事件監聽器
    this.eventBus.on(modernEvent, async (data) => {
      this.recordConversion(modernEvent, 'MODERN_TRIGGERED')
      try {
        // 為 handler 提供包含事件類型的物件
        const eventObject = {
          type: modernEvent,
          data,
          timestamp: Date.now(),
          isLegacy: false
        }
        await handler(eventObject)
      } catch (error) {
        this.recordConversionError('HANDLER_ERROR', error.message)
      }
    })

    this.modernEventRegistry.add(modernEvent)
  }

  /**
   * 智能事件發射 - 根據模式決定發射策略
   * @param {string} eventName - 事件名稱 (Legacy 或 Modern)
   * @param {*} data - 事件資料
   */
  async intelligentEmit (eventName, data) {
    if (this.conversionMode === CONVERSION_MODES.DUAL_TRACK) {
      // 雙軌模式：同時發射 Legacy 和 Modern 事件
      if (this.isLegacyEvent(eventName)) {
        const modernEvent = this.convertToModernEvent(eventName)
        this.recordConversion(eventName, 'LEGACY_TRIGGERED')
        this.recordConversion(modernEvent, 'MODERN_TRIGGERED')

        // 分別發射兩個事件 - 使用個別的 await 確保兩個都執行
        await this.eventBus.emit(eventName, data)
        await this.eventBus.emit(modernEvent, data)
      } else {
        // Modern 事件，檢查是否需要發射對應的 Legacy 事件
        const legacyEvent = this.convertToLegacyEvent(eventName)
        if (legacyEvent) {
          this.recordConversion(eventName, 'MODERN_TRIGGERED')
          this.recordConversion(legacyEvent, 'LEGACY_TRIGGERED')
          await this.eventBus.emit(eventName, data)
          await this.eventBus.emit(legacyEvent, data)
        } else {
          this.recordConversion(eventName, 'MODERN_TRIGGERED')
          await this.eventBus.emit(eventName, data)
        }
      }
    } else if (this.conversionMode === CONVERSION_MODES.MODERN_ONLY) {
      // Modern Only 模式：只發射 Modern 事件
      const modernEvent = this.isLegacyEvent(eventName)
        ? this.convertToModernEvent(eventName)
        : eventName
      this.recordConversion(modernEvent, 'MODERN_TRIGGERED')
      await this.eventBus.emit(modernEvent, data)
    } else {
      // Legacy Only 模式：只發射 Legacy 事件
      const legacyEvent = this.isLegacyEvent(eventName)
        ? eventName
        : this.convertToLegacyEvent(eventName) || eventName
      this.recordConversion(legacyEvent, 'LEGACY_TRIGGERED')
      await this.eventBus.emit(legacyEvent, data)
    }
  }

  /**
   * 轉換為 Modern 事件格式
   * @param {string} legacyEvent - 舊版事件
   * @returns {string} Modern 事件格式
   */
  convertToModernEvent (legacyEvent) {
    return this.conversionMap[legacyEvent] || this.buildModernEventName(legacyEvent)
  }

  /**
   * 轉換為 Legacy 事件格式
   * @param {string} modernEvent - 現代事件
   * @returns {string|null} Legacy 事件格式
   */
  convertToLegacyEvent (modernEvent) {
    return this.modernToLegacyMap[modernEvent] || null
  }

  /**
   * 建構 Modern 事件名稱 (智能推斷)
   * @param {string} legacyEvent - 舊版事件
   * @returns {string} 推斷的 Modern 事件名稱
   */
  buildModernEventName (legacyEvent) {
    const parts = legacyEvent.split('.')
    if (parts.length === 3) {
      const [module, action, state] = parts

      // 智能推斷 Domain 和 Platform
      const domain = this.inferDomain(module)
      const platform = this.inferPlatform(module, action)

      return `${domain}.${platform}.${action}.${state}`
    }

    // 如果無法轉換，保持原事件名稱並記錄警告
    // eslint-disable-next-line no-console
    console.warn(`Unable to convert legacy event: ${legacyEvent}`)
    return legacyEvent
  }

  /**
   * 推斷領域 (Domain)
   * @param {string} module - 舊版模組名稱
   * @returns {string} 推斷的領域
   */
  inferDomain (module) {
    const domainMapping = {
      EXTRACTION: 'EXTRACTION',
      STORAGE: 'DATA',
      UI: 'UX',
      POPUP: 'UX',
      BACKGROUND: 'SYSTEM',
      CONTENT: 'MESSAGING',
      DIAGNOSTIC: 'SYSTEM',
      ERROR: 'SYSTEM',
      PLATFORM: 'PLATFORM',
      ANALYTICS: 'ANALYTICS',
      EXPORT: 'DATA' // 修復：匯出功能屬於資料領域
    }

    return domainMapping[module] || 'SYSTEM'
  }

  /**
   * 推斷平台 (Platform)
   * @param {string} module - 舊版模組名稱
   * @param {string} action - 動作名稱
   * @returns {string} 推斷的平台
   */
  inferPlatform (module, action) {
    // 根據上下文推斷平台
    if (module === 'EXTRACTION' || module === 'STORAGE') {
      return 'READMOO' // 目前主要平台
    }

    if (module === 'UI' || module === 'POPUP') {
      return 'GENERIC' // UI 通常是平台無關的
    }

    if (module === 'PLATFORM') {
      return 'READMOO' // 平台操作預設為當前平台
    }

    if (module === 'CONTENT') {
      return 'READMOO' // CONTENT 模組在 Readmoo 上下文中
    }

    return 'GENERIC' // 預設為平台無關
  }

  /**
   * 檢查是否為 Legacy 事件
   * @param {string} eventName - 事件名稱
   * @returns {boolean} 是否為 Legacy 事件
   */
  isLegacyEvent (eventName) {
    // 檢查是否在Legacy事件映射表中存在
    return Object.prototype.hasOwnProperty.call(this.conversionMap, eventName)
  }

  /**
   * 記錄轉換統計
   * @param {string} eventName - 事件名稱
   * @param {string} type - 類型
   */
  recordConversion (eventName, type) {
    this.conversionStats.totalConversions++

    if (type === 'LEGACY_TRIGGERED') {
      this.conversionStats.legacyTriggered++
    } else if (type === 'MODERN_TRIGGERED') {
      this.conversionStats.modernTriggered++
    }
  }

  /**
   * 記錄轉換錯誤
   * @param {string} errorType - 錯誤類型
   * @param {string} message - 錯誤訊息
   */
  recordConversionError (errorType, message) {
    this.conversionStats.conversionErrors++
    // eslint-disable-next-line no-console
    console.error(`Conversion error [${errorType}]: ${message}`)
  }

  /**
   * 設定轉換模式
   * @param {string} mode - 轉換模式
   */
  setConversionMode (mode) {
    if (!this.isValidConversionMode(mode)) {
      throw new StandardError('INVALID_DATA_FORMAT', 'Invalid conversion mode', {
        category: 'general'
      })
    }
    this.conversionMode = mode
  }

  /**
   * 驗證轉換模式是否有效
   * @param {string} mode - 轉換模式
   * @returns {boolean} 是否有效
   */
  isValidConversionMode (mode) {
    return Object.values(CONVERSION_MODES).includes(mode)
  }

  /**
   * 取得轉換統計
   * @returns {Object} 轉換統計資訊
   */
  getConversionStats () {
    const successfulConversions = this.conversionStats.totalConversions - this.conversionStats.conversionErrors
    const conversionSuccessRate = this.conversionStats.totalConversions > 0
      ? successfulConversions / this.conversionStats.totalConversions
      : 0

    return {
      totalConversions: this.conversionStats.totalConversions,
      legacyEventCount: this.conversionStats.legacyTriggered,
      modernEventCount: this.conversionStats.modernTriggered,
      conversionErrors: this.conversionStats.conversionErrors,
      conversionMode: this.conversionMode,
      modernEventsRegistered: this.modernEventRegistry.size,
      conversionSuccessRate
    }
  }
}

module.exports = EventNamingUpgradeCoordinator
