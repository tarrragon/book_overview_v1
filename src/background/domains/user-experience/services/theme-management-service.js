/**
 * 主題管理服務
 *
 * 負責功能：
 * - 深色/淺色主題切換和管理
 * - 響應式主題適配和自動切換
 * - 主題偏好的持久化存儲
 * - 跨組件主題同步和協調
 *
 * 設計考量：
 * - 支援自動主題檢測（跟隨系統）
 * - 主題提供者註冊機制
 * - 主題變更的事件通知系統
 * - 主題狀態的一致性保證
 *
 * 處理流程：
 * 1. 載入使用者主題偏好
 * 2. 檢測系統主題設定
 * 3. 應用主題到所有註冊的提供者
 * 4. 發送主題變更事件通知
 *
 * 使用情境：
 * - 全域主題管理和切換
 * - Popup UI 主題協調
 * - 主題偏好持久化
 * - 跨模組主題同步
 */

class ThemeManagementService {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null
    this.logger = dependencies.logger || console
    this.storageService = dependencies.storageService || null

    // 服務狀態
    this.state = {
      initialized: false,
      active: false
    }

    // 主題管理
    this.currentTheme = 'auto'
    this.systemTheme = 'light'
    this.effectiveTheme = 'light' // 實際應用的主題
    this.themeProviders = new Map()
    this.themeHistory = []

    // 主題配置
    this.availableThemes = ['light', 'dark', 'auto']
    this.themeConfig = {
      light: {
        id: 'light',
        name: '淺色主題',
        mode: 'light',
        colors: {
          primary: '#007AFF',
          background: '#FFFFFF',
          surface: '#F2F2F7',
          text: '#000000',
          textSecondary: '#8E8E93',
          border: '#C6C6C8',
          success: '#34C759',
          warning: '#FF9500',
          error: '#FF3B30'
        },
        typography: {
          fontSize: '14px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }
      },
      dark: {
        id: 'dark',
        name: '深色主題',
        mode: 'dark',
        colors: {
          primary: '#007AFF',
          background: '#000000',
          surface: '#1C1C1E',
          text: '#FFFFFF',
          textSecondary: '#8E8E93',
          border: '#38383A',
          success: '#30D158',
          warning: '#FF9F0A',
          error: '#FF453A'
        },
        typography: {
          fontSize: '14px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }
      }
    }

    // 主題統計
    this.stats = {
      themeChanges: 0,
      providersNotified: 0,
      systemThemeChecks: 0,
      autoSwitches: 0
    }

    // 系統主題監聽器
    this.systemThemeListener = null
  }

  /**
   * 初始化主題管理服務
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('⚠️ 主題管理服務已初始化')
      return
    }

    try {
      this.logger.log('🎯 初始化主題管理服務')

      // 檢測系統主題
      await this.detectSystemTheme()

      // 載入使用者主題偏好
      await this.loadUserThemePreference()

      // 設定系統主題監聽
      await this.setupSystemThemeListener()

      // 註冊事件監聽器
      await this.registerEventListeners()

      this.state.initialized = true
      this.logger.log('✅ 主題管理服務初始化完成')

      // 發送初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.THEME.SERVICE.INITIALIZED', {
          serviceName: 'ThemeManagementService',
          currentTheme: this.currentTheme,
          effectiveTheme: this.effectiveTheme,
          systemTheme: this.systemTheme
        })
      }
    } catch (error) {
      this.logger.error('❌ 初始化主題管理服務失敗:', error)
      throw error
    }
  }

  /**
   * 啟動主題管理服務
   */
  async start () {
    if (!this.state.initialized) {
      throw new Error('主題管理服務尚未初始化')
    }

    if (this.state.active) {
      this.logger.warn('⚠️ 主題管理服務已啟動')
      return
    }

    try {
      this.logger.log('🚀 啟動主題管理服務')

      // 應用初始主題
      await this.applyInitialTheme()

      this.state.active = true
      this.logger.log('✅ 主題管理服務啟動完成')

      // 發送啟動完成事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.THEME.SERVICE.STARTED', {
          serviceName: 'ThemeManagementService',
          ready: true
        })
      }
    } catch (error) {
      this.logger.error('❌ 啟動主題管理服務失敗:', error)
      throw error
    }
  }

  /**
   * 設定主題
   */
  async setTheme (theme) {
    this.logger.log(`🎨 設定主題: ${theme}`)

    try {
      // 驗證主題有效性
      if (!this.isValidTheme(theme)) {
        throw new Error(`無效的主題: ${theme}`)
      }

      // 統計主題變更
      this.stats.themeChanges++

      // 記錄主題變更歷史
      this.themeHistory.push({
        fromTheme: this.currentTheme,
        toTheme: theme,
        timestamp: Date.now(),
        trigger: 'manual'
      })

      // 更新當前主題
      this.currentTheme = theme

      // 計算有效主題
      const newEffectiveTheme = this.calculateEffectiveTheme(theme)

      // 如果有效主題發生變化，通知所有提供者
      if (newEffectiveTheme !== this.effectiveTheme) {
        this.effectiveTheme = newEffectiveTheme
        await this.notifyThemeProviders(this.effectiveTheme)
      }

      // 持久化主題偏好
      await this.persistThemePreference(theme)

      // 發送主題變更事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.THEME.CHANGED', {
          theme,
          effectiveTheme: this.effectiveTheme,
          systemTheme: this.systemTheme,
          timestamp: Date.now(),
          providersNotified: this.themeProviders.size
        })
      }

      this.logger.log(`✅ 主題設定完成: ${theme} (有效主題: ${this.effectiveTheme})`)
      return { success: true, theme, effectiveTheme: this.effectiveTheme }
    } catch (error) {
      this.logger.error(`❌ 主題設定失敗: ${theme}`, error)
      throw error
    }
  }

  /**
   * 獲取當前主題
   */
  getCurrentTheme () {
    return {
      currentTheme: this.currentTheme,
      effectiveTheme: this.effectiveTheme,
      systemTheme: this.systemTheme,
      isAutoMode: this.currentTheme === 'auto'
    }
  }

  /**
   * 獲取可用主題列表
   */
  getAvailableThemes () {
    return this.availableThemes.map(themeId => ({
      id: themeId,
      name: this.themeConfig[themeId]?.name || themeId,
      config: this.themeConfig[themeId]
    }))
  }

  /**
   * 註冊主題提供者
   */
  registerThemeProvider (providerId, provider) {
    this.logger.log(`🔗 註冊主題提供者: ${providerId}`)

    try {
      // 驗證提供者介面
      if (!provider || typeof provider.updateTheme !== 'function') {
        throw new Error(`主題提供者 ${providerId} 必須實現 updateTheme 方法`)
      }

      // 註冊提供者
      this.themeProviders.set(providerId, provider)

      // 如果服務已啟動，立即應用當前主題
      if (this.state.active) {
        provider.updateTheme(this.effectiveTheme, this.themeConfig[this.effectiveTheme])
      }

      this.logger.log(`✅ 主題提供者註冊完成: ${providerId}`)

      // 發送提供者註冊事件
      if (this.eventBus) {
        this.eventBus.emit('UX.THEME.PROVIDER.REGISTERED', {
          providerId,
          totalProviders: this.themeProviders.size
        })
      }
    } catch (error) {
      this.logger.error(`❌ 主題提供者註冊失敗: ${providerId}`, error)
      throw error
    }
  }

  /**
   * 取消註冊主題提供者
   */
  unregisterThemeProvider (providerId) {
    this.logger.log(`🔌 取消註冊主題提供者: ${providerId}`)

    const removed = this.themeProviders.delete(providerId)

    if (removed) {
      this.logger.log(`✅ 主題提供者取消註冊完成: ${providerId}`)
    } else {
      this.logger.warn(`⚠️ 主題提供者不存在: ${providerId}`)
    }

    return removed
  }

  /**
   * 檢測系統主題
   */
  async detectSystemTheme () {
    try {
      this.stats.systemThemeChecks++

      // 在 Chrome Extension 環境中檢測系統主題
      if (typeof window !== 'undefined' && window.matchMedia) {
        const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)')
        this.systemTheme = darkModeQuery.matches ? 'dark' : 'light'
      } else {
        // 後備檢測方法（例如通過 Chrome API）
        this.systemTheme = await this.fallbackSystemThemeDetection()
      }

      this.logger.log(`🔍 檢測到系統主題: ${this.systemTheme}`)
    } catch (error) {
      this.logger.error('❌ 檢測系統主題失敗:', error)
      // 使用預設淺色主題
      this.systemTheme = 'light'
    }
  }

  /**
   * 載入使用者主題偏好
   */
  async loadUserThemePreference () {
    try {
      if (this.storageService) {
        const savedTheme = await this.storageService.get('user.theme.preference')
        if (savedTheme && this.isValidTheme(savedTheme)) {
          this.currentTheme = savedTheme
          this.logger.log(`📖 載入使用者主題偏好: ${savedTheme}`)
        }
      }
    } catch (error) {
      this.logger.error('❌ 載入使用者主題偏好失敗:', error)
      // 使用預設主題
      this.currentTheme = 'auto'
    }
  }

  /**
   * 設定系統主題監聽
   */
  async setupSystemThemeListener () {
    try {
      if (typeof window !== 'undefined' && window.matchMedia) {
        const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)')

        this.systemThemeListener = (event) => {
          const newSystemTheme = event.matches ? 'dark' : 'light'
          this.handleSystemThemeChange(newSystemTheme)
        }

        darkModeQuery.addEventListener('change', this.systemThemeListener)
        this.logger.log('✅ 系統主題監聽器設定完成')
      }
    } catch (error) {
      this.logger.error('❌ 設定系統主題監聽器失敗:', error)
    }
  }

  /**
   * 處理系統主題變更
   */
  async handleSystemThemeChange (newSystemTheme) {
    this.logger.log(`🔄 系統主題變更: ${this.systemTheme} → ${newSystemTheme}`)

    const oldSystemTheme = this.systemTheme
    this.systemTheme = newSystemTheme

    // 如果使用者設定為自動模式，更新有效主題
    if (this.currentTheme === 'auto') {
      this.stats.autoSwitches++

      const newEffectiveTheme = this.calculateEffectiveTheme(this.currentTheme)

      if (newEffectiveTheme !== this.effectiveTheme) {
        this.effectiveTheme = newEffectiveTheme

        // 記錄自動主題切換歷史
        this.themeHistory.push({
          fromTheme: this.currentTheme,
          toTheme: this.currentTheme,
          fromEffective: oldSystemTheme,
          toEffective: newEffectiveTheme,
          timestamp: Date.now(),
          trigger: 'system_auto'
        })

        // 通知所有提供者
        await this.notifyThemeProviders(this.effectiveTheme)

        // 發送系統主題變更事件
        if (this.eventBus) {
          await this.eventBus.emit('UX.THEME.SYSTEM.CHANGED', {
            oldSystemTheme,
            newSystemTheme,
            effectiveTheme: this.effectiveTheme,
            autoMode: true,
            timestamp: Date.now()
          })
        }
      }
    }
  }

  /**
   * 計算有效主題
   */
  calculateEffectiveTheme (theme) {
    if (theme === 'auto') {
      return this.systemTheme
    }

    return this.isValidTheme(theme) ? theme : 'light'
  }

  /**
   * 通知主題提供者
   */
  async notifyThemeProviders (effectiveTheme) {
    this.logger.log(`📢 通知主題提供者: ${effectiveTheme}`)

    const themeConfig = this.themeConfig[effectiveTheme]
    const results = []

    for (const [providerId, provider] of this.themeProviders) {
      try {
        await provider.updateTheme(effectiveTheme, themeConfig)
        results.push({ providerId, success: true })
        this.stats.providersNotified++
      } catch (error) {
        this.logger.error(`❌ 通知主題提供者失敗 (${providerId}):`, error)
        results.push({ providerId, success: false, error: error.message })
      }
    }

    this.logger.log(`✅ 主題提供者通知完成: ${results.filter(r => r.success).length}/${results.length}`)
    return results
  }

  /**
   * 應用初始主題
   */
  async applyInitialTheme () {
    this.effectiveTheme = this.calculateEffectiveTheme(this.currentTheme)

    if (this.themeProviders.size > 0) {
      await this.notifyThemeProviders(this.effectiveTheme)
    }

    this.logger.log(`🎨 應用初始主題: ${this.currentTheme} (有效: ${this.effectiveTheme})`)
  }

  /**
   * 持久化主題偏好
   */
  async persistThemePreference (theme) {
    try {
      if (this.storageService) {
        await this.storageService.set('user.theme.preference', theme)
        this.logger.log(`💾 主題偏好已保存: ${theme}`)
      }
    } catch (error) {
      this.logger.error('❌ 持久化主題偏好失敗:', error)
    }
  }

  /**
   * 後備系統主題檢測
   */
  async fallbackSystemThemeDetection () {
    // 可以通過 Chrome API 或其他方法檢測
    // 暫時返回淺色主題作為預設
    return 'light'
  }

  /**
   * 驗證主題有效性
   */
  isValidTheme (theme) {
    return this.availableThemes.includes(theme)
  }

  /**
   * 註冊事件監聽器
   */
  async registerEventListeners () {
    if (!this.eventBus) {
      this.logger.warn('⚠️ EventBus 不可用，跳過主題事件監聽器註冊')
      return
    }

    // 監聽主題變更請求
    await this.eventBus.on('UX.THEME.CHANGE.REQUEST', async (event) => {
      const { theme } = event.data || {}
      if (theme) {
        await this.setTheme(theme)
      }
    })

    // 監聽主題查詢請求
    await this.eventBus.on('UX.THEME.GET.REQUEST', async (event) => {
      const currentTheme = this.getCurrentTheme()

      if (this.eventBus) {
        await this.eventBus.emit('UX.THEME.GET.RESPONSE', {
          requestId: event.data?.requestId,
          theme: currentTheme
        })
      }
    })

    this.logger.log('✅ 主題事件監聽器註冊完成')
  }

  /**
   * 獲取主題統計
   */
  getThemeStats () {
    return {
      ...this.stats,
      currentTheme: this.currentTheme,
      effectiveTheme: this.effectiveTheme,
      systemTheme: this.systemTheme,
      providersCount: this.themeProviders.size,
      historyCount: this.themeHistory.length
    }
  }

  /**
   * 獲取主題歷史
   */
  getThemeHistory (limit = 10) {
    return this.themeHistory
      .slice(-limit)
      .map(entry => ({ ...entry }))
  }

  /**
   * 獲取服務狀態
   */
  getStatus () {
    return {
      service: 'ThemeManagementService',
      initialized: this.state.initialized,
      active: this.state.active,
      currentTheme: this.currentTheme,
      effectiveTheme: this.effectiveTheme,
      systemTheme: this.systemTheme,
      providersCount: this.themeProviders.size,
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    return {
      service: 'ThemeManagementService',
      healthy: this.state.initialized && this.state.active,
      status: this.state.active ? 'active' : 'inactive',
      currentTheme: this.currentTheme,
      effectiveTheme: this.effectiveTheme,
      systemTheme: this.systemTheme,
      metrics: {
        themeChanges: this.stats.themeChanges,
        providersNotified: this.stats.providersNotified,
        systemThemeChecks: this.stats.systemThemeChecks,
        autoSwitches: this.stats.autoSwitches,
        providersRegistered: this.themeProviders.size
      }
    }
  }

  /**
   * 清理資源
   */
  async cleanup () {
    // 移除系統主題監聽器
    if (this.systemThemeListener && typeof window !== 'undefined' && window.matchMedia) {
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)')
      darkModeQuery.removeEventListener('change', this.systemThemeListener)
    }

    // 清空主題提供者
    this.themeProviders.clear()

    this.logger.log('✅ 主題管理服務清理完成')
  }
}

module.exports = ThemeManagementService
