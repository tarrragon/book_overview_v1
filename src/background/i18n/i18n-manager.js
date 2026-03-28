/**
 * 國際化 (i18n) 管理器
 *
 * 負責功能：
 * - 管理多語言文字資源的載入和切換
 * - 提供文字參數替換和格式化功能
 * - 支援動態語言切換和回退機制
 * - 提供統一的文字存取介面
 *
 * 設計考量：
 * - 基於 BaseModule 實現標準生命週期管理
 * - 支援巢狀鍵值和點記法存取
 * - 實現記憶體快取和延遲載入
 * - 提供開發模式的缺失翻譯檢測
 */

const BaseModule = require('src/background/lifecycle/base-module')
const ErrorCodes = require('src/core/errors/ErrorCodes')

class I18nManager extends BaseModule {
  constructor (dependencies = {}) {
    super(dependencies)

    // 語言配置
    this.currentLanguage = 'zh-tw'
    this.fallbackLanguage = 'en-us'
    this.supportedLanguages = new Set(['zh-tw', 'en-us'])

    // 語言資源快取
    this.languageCache = new Map()
    this.loadingPromises = new Map()

    // 參數替換配置
    this.parameterPattern = /\{([^}]+)\}/g
    this.missingTranslations = new Set()

    // 開發模式設定
    this.debugMode = dependencies.debugMode || false
    this.logMissingTranslations = true
  }

  /**
   * 初始化 i18n 管理器
   * @returns {Promise<void>}
   * @protected
   */
  async _doInitialize () {
    this.logger.log('🌐 初始化 i18n 管理器')

    // 偵測系統語言
    await this.detectSystemLanguage()

    // 預載入當前語言和回退語言
    await this.preloadLanguages()

    this.logger.log(`✅ i18n 管理器初始化完成，當前語言: ${this.currentLanguage}`)
  }

  /**
   * 偵測系統語言
   * @returns {Promise<void>}
   * @private
   */
  async detectSystemLanguage () {
    try {
      // 嘗試從 Chrome Storage 讀取使用者偏好
      const stored = await chrome.storage.local.get(['preferredLanguage'])
      if (stored.preferredLanguage && this.supportedLanguages.has(stored.preferredLanguage)) {
        this.currentLanguage = stored.preferredLanguage
        return
      }

      // 使用瀏覽器語言
      const browserLanguage = navigator.language || navigator.userLanguage
      const languageCode = this.normalizeLangCode(browserLanguage)

      if (this.supportedLanguages.has(languageCode)) {
        this.currentLanguage = languageCode
      } else {
        // 使用預設語言
        this.currentLanguage = 'zh-tw'
      }

      this.logger.log(`🌐 偵測到系統語言: ${browserLanguage} → ${this.currentLanguage}`)
    } catch (error) {
      this.logger.error('❌ 偵測系統語言失敗:', error)
      // 使用預設語言
      this.currentLanguage = 'zh-tw'
    }
  }

  /**
   * 正規化語言代碼
   * @param {string} langCode - 原始語言代碼
   * @returns {string} 正規化後的語言代碼
   * @private
   */
  normalizeLangCode (langCode) {
    if (!langCode) return 'zh-tw'

    const normalized = langCode.toLowerCase().replace('_', '-')

    // 特殊處理
    if (normalized.startsWith('zh-tw') || normalized.startsWith('zh-hant')) {
      return 'zh-tw'
    }
    if (normalized.startsWith('zh')) {
      return 'zh-tw' // 預設使用繁體中文
    }
    if (normalized.startsWith('en')) {
      return 'en-us'
    }

    return normalized
  }

  /**
   * 預載入語言資源
   * @returns {Promise<void>}
   * @private
   */
  async preloadLanguages () {
    const languagesToLoad = [this.currentLanguage]

    // 如果當前語言不是回退語言，也預載入回退語言
    if (this.currentLanguage !== this.fallbackLanguage) {
      languagesToLoad.push(this.fallbackLanguage)
    }

    const loadPromises = languagesToLoad.map(lang => this.loadLanguage(lang))
    await Promise.all(loadPromises)
  }

  /**
   * 載入語言資源
   * @param {string} languageCode - 語言代碼
   * @returns {Promise<Object>} 語言資源物件
   * @private
   */
  async loadLanguage (languageCode) {
    // 檢查快取
    if (this.languageCache.has(languageCode)) {
      return this.languageCache.get(languageCode)
    }

    // 檢查是否正在載入
    if (this.loadingPromises.has(languageCode)) {
      return await this.loadingPromises.get(languageCode)
    }

    // 開始載入
    const loadingPromise = this._loadLanguageResource(languageCode)
    this.loadingPromises.set(languageCode, loadingPromise)

    try {
      const resource = await loadingPromise
      this.languageCache.set(languageCode, resource)
      this.loadingPromises.delete(languageCode)

      this.logger.log(`📚 語言資源載入完成: ${languageCode}`)
      return resource
    } catch (error) {
      this.loadingPromises.delete(languageCode)
      throw error
    }
  }

  /**
   * 實際載入語言資源檔案
   * @param {string} languageCode - 語言代碼
   * @returns {Promise<Object>} 語言資源物件
   * @private
   */
  async _loadLanguageResource (languageCode) {
    try {
      // 動態 require 語言檔案
      let resource = null

      switch (languageCode) {
        case 'zh-tw':
          resource = require('./locales/zh-tw')
          break
        case 'en-us':
          resource = require('./locales/en-us')
          break
        default: {
          const error = new Error(`不支援的語言代碼: ${languageCode}`)
          error.code = ErrorCodes.UNKNOWN_ERROR
          error.details = { category: 'general' }
          throw error
        }
      }

      if (!resource || typeof resource !== 'object') {
        const error = new Error(`語言資源格式錯誤: ${languageCode}`)
        error.code = ErrorCodes.UNKNOWN_ERROR
        error.details = { category: 'general' }
        throw error
      }

      return resource
    } catch (error) {
      this.logger.error(`❌ 載入語言資源失敗: ${languageCode}`, error)
      throw error
    }
  }

  /**
   * 獲取翻譯文字
   * @param {string} key - 翻譯鍵值 (支援點記法，如 'system.status.healthy')
   * @param {Object} params - 參數物件，用於替換 {paramName} 格式的佔位符
   * @param {string} language - 指定語言（可選，預設使用當前語言）
   * @returns {string} 翻譯後的文字
   */
  t (key, params = {}, language = null) {
    const targetLanguage = language || this.currentLanguage

    try {
      // 嘗試從目標語言獲取翻譯
      let translation = this.getTranslationFromLanguage(key, targetLanguage)

      // 如果找不到且目標語言不是回退語言，嘗試回退語言
      if (!translation && targetLanguage !== this.fallbackLanguage) {
        translation = this.getTranslationFromLanguage(key, this.fallbackLanguage)

        if (this.debugMode) {
          this.logger.warn(`⚠️ 使用回退語言翻譯: ${key} (${targetLanguage} → ${this.fallbackLanguage})`)
        }
      }

      // 如果還是找不到，記錄缺失翻譯
      if (!translation) {
        this.handleMissingTranslation(key, targetLanguage)
        return `[${key}]` // 返回鍵值本身作為預設值
      }

      // 參數替換
      return this.replaceParameters(translation, params)
    } catch (error) {
      this.logger.error(`❌ 獲取翻譯失敗: ${key}`, error)
      return `[${key}]`
    }
  }

  /**
   * 從指定語言獲取翻譯
   * @param {string} key - 翻譯鍵值
   * @param {string} languageCode - 語言代碼
   * @returns {string|null} 翻譯文字或 null
   * @private
   */
  getTranslationFromLanguage (key, languageCode) {
    const resource = this.languageCache.get(languageCode)
    if (!resource) {
      return null
    }

    // 支援點記法存取巢狀物件
    const keyParts = key.split('.')
    let current = resource

    for (const part of keyParts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part]
      } else {
        return null
      }
    }

    return typeof current === 'string' ? current : null
  }

  /**
   * 替換文字中的參數
   * @param {string} text - 包含參數佔位符的文字
   * @param {Object} params - 參數物件
   * @returns {string} 替換後的文字
   * @private
   */
  replaceParameters (text, params) {
    if (!text || typeof text !== 'string' || !params || typeof params !== 'object') {
      return text
    }

    return text.replace(this.parameterPattern, (match, paramName) => {
      const paramValue = params[paramName]

      if (paramValue !== undefined && paramValue !== null) {
        return String(paramValue)
      } else {
        if (this.debugMode) {
          this.logger.warn(`⚠️ 參數缺失: ${paramName} in "${text}"`)
        }
        return match // 保留原始佔位符
      }
    })
  }

  /**
   * 處理缺失的翻譯
   * @param {string} key - 翻譯鍵值
   * @param {string} languageCode - 語言代碼
   * @private
   */
  handleMissingTranslation (key, languageCode) {
    const missingKey = `${languageCode}:${key}`

    if (!this.missingTranslations.has(missingKey)) {
      this.missingTranslations.add(missingKey)

      if (this.logMissingTranslations) {
        this.logger.warn(`⚠️ 缺失翻譯: ${key} (語言: ${languageCode})`)
      }
    }
  }

  /**
   * 切換語言
   * @param {string} languageCode - 新的語言代碼
   * @returns {Promise<boolean>} 切換是否成功
   */
  async switchLanguage (languageCode) {
    if (!this.supportedLanguages.has(languageCode)) {
      this.logger.error(`❌ 不支援的語言代碼: ${languageCode}`)
      return false
    }

    if (languageCode === this.currentLanguage) {
      return true // 已經是當前語言
    }

    try {
      // 載入新語言資源（如果尚未載入）
      await this.loadLanguage(languageCode)

      // 切換當前語言
      const previousLanguage = this.currentLanguage
      this.currentLanguage = languageCode

      // 儲存使用者偏好
      await chrome.storage.local.set({ preferredLanguage: languageCode })

      // 觸發語言切換事件
      if (this.eventBus) {
        await this.eventBus.emit('I18N.LANGUAGE.CHANGED', {
          previousLanguage,
          currentLanguage: languageCode,
          timestamp: Date.now()
        })
      }

      this.logger.log(`🌐 語言切換完成: ${previousLanguage} → ${languageCode}`)
      return true
    } catch (error) {
      this.logger.error(`❌ 語言切換失敗: ${languageCode}`, error)
      return false
    }
  }

  /**
   * 獲取當前語言
   * @returns {string} 當前語言代碼
   */
  getCurrentLanguage () {
    return this.currentLanguage
  }

  /**
   * 獲取支援的語言列表
   * @returns {Array<string>} 支援的語言代碼陣列
   */
  getSupportedLanguages () {
    return Array.from(this.supportedLanguages)
  }

  /**
   * 檢查語言是否已載入
   * @param {string} languageCode - 語言代碼
   * @returns {boolean} 是否已載入
   */
  isLanguageLoaded (languageCode) {
    return this.languageCache.has(languageCode)
  }

  /**
   * 獲取缺失的翻譯列表
   * @returns {Array<string>} 缺失翻譯的鍵值列表
   */
  getMissingTranslations () {
    return Array.from(this.missingTranslations)
  }

  /**
   * 清除缺失翻譯記錄
   */
  clearMissingTranslations () {
    this.missingTranslations.clear()
  }

  /**
   * 預載入語言資源
   * @param {string} languageCode - 語言代碼
   * @returns {Promise<boolean>} 載入是否成功
   */
  async preloadLanguage (languageCode) {
    if (!this.supportedLanguages.has(languageCode)) {
      return false
    }

    try {
      await this.loadLanguage(languageCode)
      return true
    } catch (error) {
      this.logger.error(`❌ 預載入語言失敗: ${languageCode}`, error)
      return false
    }
  }

  /**
   * 獲取 i18n 管理器狀態
   * @returns {Object} i18n 狀態報告
   */
  getI18nStatus () {
    return {
      currentLanguage: this.currentLanguage,
      fallbackLanguage: this.fallbackLanguage,
      supportedLanguages: Array.from(this.supportedLanguages),
      loadedLanguages: Array.from(this.languageCache.keys()),
      loadingLanguages: Array.from(this.loadingPromises.keys()),
      missingTranslationsCount: this.missingTranslations.size,
      debugMode: this.debugMode,
      timestamp: Date.now()
    }
  }

  /**
   * 取得自訂健康狀態
   * @returns {Object} 自訂健康狀態
   * @protected
   */
  _getCustomHealthStatus () {
    const loadedLanguagesCount = this.languageCache.size
    const requiredLanguagesCount = 2 // 當前語言和回退語言
    const missingTranslationsCount = this.missingTranslations.size

    return {
      currentLanguage: this.currentLanguage,
      loadedLanguages: loadedLanguagesCount,
      missingTranslations: missingTranslationsCount,
      hasRequiredLanguages: loadedLanguagesCount >= requiredLanguagesCount,
      health: loadedLanguagesCount < requiredLanguagesCount ? 'degraded' : 'healthy'
    }
  }
}

module.exports = I18nManager
