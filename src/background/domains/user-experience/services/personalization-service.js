/**
 * 個人化服務
 *
 * 負責功能：
 * - 使用者行為分析和學習
 * - 個人化推薦和建議生成
 * - 使用者偏好的智能調整
 * - 個人化體驗的持續優化
 *
 * 設計考量：
 * - 隱私保護的本地化學習
 * - 行為模式識別和分析
 * - 漸進式個人化改進
 * - 個人化設定的可控性
 *
 * 處理流程：
 * 1. 收集使用者行為數據
 * 2. 分析使用模式和偏好
 * 3. 生成個人化建議
 * 4. 應用個人化設定
 *
 * 使用情境：
 * - 智能主題推薦
 * - 功能使用優化建議
 * - 個人化介面調整
 * - 使用習慣分析
 */

const { ErrorCodes } = require('src/core/errors/ErrorCodes')

class PersonalizationService {
  constructor (dependencies = {}) {
    // 依賴注入
    this.eventBus = dependencies.eventBus || null

    // Logger 後備方案: Background Service 初始化保護
    // 設計理念: 個人化服務管理用戶個性化設定和客製化體驗
    // 執行環境: Service Worker 初始化階段，依賴注入可能不完整
    // 後備機制: console 確保模組生命週期錯誤能被追蹤
    // 風險考量: 理想上應確保 Logger 完整可用，此為過渡性保護
    this.logger = dependencies.logger || console
    this.preferenceService = dependencies.preferenceService || null
    this.storageService = dependencies.storageService || null

    // 服務狀態
    this.state = {
      initialized: false,
      active: false,
      learningEnabled: true
    }

    // 個人化數據
    this.userProfile = {
      preferences: new Map(),
      behaviorPatterns: new Map(),
      usageStats: new Map(),
      recommendations: []
    }

    // 行為追蹤
    this.behaviorHistory = []
    this.sessionData = {
      startTime: Date.now(),
      actions: [],
      patterns: new Map()
    }

    // 學習配置
    this.learningConfig = {
      historyLimit: 1000,
      sessionTimeout: 1800000, // 30分鐘
      minDataPoints: 10,
      confidenceThreshold: 0.7,
      updateInterval: 300000 // 5分鐘
    }

    // 個人化統計
    this.stats = {
      behaviorRecorded: 0,
      patternsDetected: 0,
      recommendationsGenerated: 0,
      recommendationsApplied: 0,
      profileUpdates: 0
    }
  }

  /**
   * 初始化個人化服務
   */
  async initialize () {
    if (this.state.initialized) {
      this.logger.warn('[WARN] 個人化服務已初始化')
      return
    }

    try {
      this.logger.log('初始化個人化服務')

      // 載入使用者檔案
      await this.loadUserProfile()

      // 初始化行為追蹤
      await this.initializeBehaviorTracking()

      // 註冊事件監聽器
      await this.registerEventListeners()

      // 啟動學習引擎
      await this.startLearningEngine()

      this.state.initialized = true
      this.logger.log('[OK] 個人化服務初始化完成')

      // 發送初始化完成事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.PERSONALIZATION.SERVICE.INITIALIZED', {
          serviceName: 'PersonalizationService',
          learningEnabled: this.state.learningEnabled
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 初始化個人化服務失敗:', error)
      throw error
    }
  }

  /**
   * 啟動個人化服務
   */
  async start () {
    if (!this.state.initialized) {
      const error = new Error('個人化服務尚未初始化')
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = { category: 'general' }
      throw error
    }

    if (this.state.active) {
      this.logger.warn('[WARN] 個人化服務已啟動')
      return
    }

    try {
      this.logger.log('[START] 啟動個人化服務')

      // 生成初始推薦
      await this.generateInitialRecommendations()

      // 開始會話追蹤
      this.startSessionTracking()

      this.state.active = true
      this.logger.log('[OK] 個人化服務啟動完成')

      // 發送啟動完成事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.PERSONALIZATION.SERVICE.STARTED', {
          serviceName: 'PersonalizationService',
          ready: true
        })
      }
    } catch (error) {
      this.logger.error('[FAIL] 啟動個人化服務失敗:', error)
      throw error
    }
  }

  /**
   * 記錄使用者行為
   */
  async recordUserAction (action) {
    if (!this.state.learningEnabled) {
      return
    }

    this.logger.log(`[LOG] 記錄使用者行為: ${action.type}`)

    try {
      // 統計行為記錄
      this.stats.behaviorRecorded++

      // 標準化行為數據
      const behaviorData = {
        id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: action.type,
        category: action.category || 'general',
        target: action.target || null,
        context: action.context || {},
        timestamp: Date.now(),
        sessionId: this.sessionData.sessionId || null
      }

      // 添加到行為歷史
      this.behaviorHistory.push(behaviorData)
      this.sessionData.actions.push(behaviorData)

      // 限制歷史記錄數量
      if (this.behaviorHistory.length > this.learningConfig.historyLimit) {
        this.behaviorHistory = this.behaviorHistory.slice(-this.learningConfig.historyLimit * 0.8)
      }

      // 更新行為模式
      await this.updateBehaviorPatterns(behaviorData)

      // 發送行為記錄事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.USER.ACTION.RECORDED', {
          action: behaviorData,
          timestamp: Date.now()
        })
      }

      this.logger.log(`[OK] 使用者行為記錄完成: ${behaviorData.id}`)
    } catch (error) {
      this.logger.error('[FAIL] 記錄使用者行為失敗:', error)
    }
  }

  /**
   * 獲取個人化檔案
   */
  getPersonalizationProfile () {
    return {
      preferences: Object.fromEntries(this.userProfile.preferences),
      behaviorPatterns: Object.fromEntries(this.userProfile.behaviorPatterns),
      usageStats: Object.fromEntries(this.userProfile.usageStats),
      recommendations: [...this.userProfile.recommendations],
      sessionStats: this.getSessionStats(),
      learningEnabled: this.state.learningEnabled
    }
  }

  /**
   * 更新個人化檔案
   */
  async updatePersonalizationProfile (updates) {
    this.logger.log('更新個人化檔案')

    try {
      // 統計檔案更新
      this.stats.profileUpdates++

      // 更新偏好設定
      if (updates.preferences) {
        for (const [key, value] of Object.entries(updates.preferences)) {
          this.userProfile.preferences.set(key, value)
        }
      }

      // 更新學習設定
      if (updates.learningEnabled !== undefined) {
        this.state.learningEnabled = updates.learningEnabled
      }

      // 持久化檔案
      await this.saveUserProfile()

      // 發送檔案更新事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.PERSONALIZATION.PROFILE.UPDATED', {
          updates,
          timestamp: Date.now()
        })
      }

      this.logger.log('[OK] 個人化檔案更新完成')
    } catch (error) {
      this.logger.error('[FAIL] 更新個人化檔案失敗:', error)
      throw error
    }
  }

  /**
   * 生成個人化推薦
   */
  async generatePersonalizedRecommendations () {
    this.logger.log('生成個人化推薦')

    try {
      const recommendations = []

      // 主題推薦
      const themeRecommendation = await this.generateThemeRecommendation()
      if (themeRecommendation) {
        recommendations.push(themeRecommendation)
      }

      // 功能使用推薦
      const featureRecommendations = await this.generateFeatureRecommendations()
      recommendations.push(...featureRecommendations)

      // 設定優化推薦
      const settingsRecommendations = await this.generateSettingsRecommendations()
      recommendations.push(...settingsRecommendations)

      // 更新推薦列表
      this.userProfile.recommendations = recommendations

      // 統計推薦生成
      this.stats.recommendationsGenerated += recommendations.length

      // 發送推薦生成事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.PERSONALIZATION.RECOMMENDATIONS.GENERATED', {
          recommendations,
          count: recommendations.length,
          timestamp: Date.now()
        })
      }

      this.logger.log(`[OK] 生成了 ${recommendations.length} 個個人化推薦`)
      return recommendations
    } catch (error) {
      this.logger.error('[FAIL] 生成個人化推薦失敗:', error)
      return []
    }
  }

  /**
   * 應用個人化建議
   */
  async applyPersonalizationSuggestion (suggestionId) {
    this.logger.log(`應用個人化建議: ${suggestionId}`)

    try {
      const suggestion = this.userProfile.recommendations.find(r => r.id === suggestionId)
      if (!suggestion) {
        const error = new Error(`找不到建議: ${suggestionId}`)
        error.code = ErrorCodes.VALIDATION_ERROR
        error.details = { category: 'general' }
        throw error
      }

      // 根據建議類型執行相應操作
      let result = null
      switch (suggestion.type) {
        case 'theme':
          result = await this.applyThemeSuggestion(suggestion)
          break
        case 'setting':
          result = await this.applySettingSuggestion(suggestion)
          break
        case 'feature':
          result = await this.applyFeatureSuggestion(suggestion)
          break
        default: {
          const error = new Error(`不支援的建議類型: ${suggestion.type}`)
          error.code = ErrorCodes.VALIDATION_ERROR
          error.details = { category: 'general' }
          throw error
        }
      }

      // 標記建議為已應用
      suggestion.applied = true
      suggestion.appliedAt = Date.now()

      // 統計建議應用
      this.stats.recommendationsApplied++

      // 發送建議應用事件
      if (this.eventBus) {
        await this.eventBus.emit('UX.PERSONALIZATION.SUGGESTION.APPLIED', {
          suggestion,
          result,
          timestamp: Date.now()
        })
      }

      this.logger.log(`[OK] 個人化建議應用完成: ${suggestionId}`)
      return { success: true, suggestion, result }
    } catch (error) {
      this.logger.error(`[FAIL] 應用個人化建議失敗: ${suggestionId}`, error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 載入使用者檔案
   */
  async loadUserProfile () {
    try {
      if (this.storageService) {
        const savedProfile = await this.storageService.get('user.personalization.profile')

        if (savedProfile) {
          // 恢復偏好設定
          if (savedProfile.preferences) {
            this.userProfile.preferences = new Map(Object.entries(savedProfile.preferences))
          }

          // 恢復行為模式
          if (savedProfile.behaviorPatterns) {
            this.userProfile.behaviorPatterns = new Map(Object.entries(savedProfile.behaviorPatterns))
          }

          // 恢復使用統計
          if (savedProfile.usageStats) {
            this.userProfile.usageStats = new Map(Object.entries(savedProfile.usageStats))
          }

          // 恢復學習設定
          if (savedProfile.learningEnabled !== undefined) {
            this.state.learningEnabled = savedProfile.learningEnabled
          }

          this.logger.log('使用者檔案載入完成')
        }
      }
    } catch (error) {
      this.logger.error('[FAIL] 載入使用者檔案失敗:', error)
    }
  }

  /**
   * 保存使用者檔案
   */
  async saveUserProfile () {
    try {
      if (this.storageService) {
        const profileData = {
          preferences: Object.fromEntries(this.userProfile.preferences),
          behaviorPatterns: Object.fromEntries(this.userProfile.behaviorPatterns),
          usageStats: Object.fromEntries(this.userProfile.usageStats),
          learningEnabled: this.state.learningEnabled,
          lastUpdated: Date.now()
        }

        await this.storageService.set('user.personalization.profile', profileData)
        this.logger.log('[SAVE] 使用者檔案保存完成')
      }
    } catch (error) {
      this.logger.error('[FAIL] 保存使用者檔案失敗:', error)
    }
  }

  /**
   * 初始化行為追蹤
   */
  async initializeBehaviorTracking () {
    // 載入行為歷史
    try {
      if (this.storageService) {
        const savedHistory = await this.storageService.get('user.behavior.history')
        if (savedHistory && Array.isArray(savedHistory)) {
          this.behaviorHistory = savedHistory.slice(-this.learningConfig.historyLimit)
        }
      }
    } catch (error) {
      this.logger.error('[FAIL] 載入行為歷史失敗:', error)
    }

    this.logger.log('[OK] 行為追蹤初始化完成')
  }

  /**
   * 啟動學習引擎
   */
  async startLearningEngine () {
    if (!this.state.learningEnabled) {
      this.logger.log('[WARN] 學習功能已禁用')
      return
    }

    // 設定定期學習更新
    setInterval(async () => {
      await this.performLearningUpdate()
    }, this.learningConfig.updateInterval)

    this.logger.log('[OK] 學習引擎啟動完成')
  }

  /**
   * 執行學習更新
   */
  async performLearningUpdate () {
    if (!this.state.learningEnabled || this.behaviorHistory.length < this.learningConfig.minDataPoints) {
      return
    }

    try {
      // 分析行為模式
      await this.analyzeBehaviorPatterns()

      // 更新使用統計
      await this.updateUsageStatistics()

      // 生成新推薦
      await this.generatePersonalizedRecommendations()

      // 保存更新的檔案
      await this.saveUserProfile()

      this.logger.log('學習更新完成')
    } catch (error) {
      this.logger.error('[FAIL] 學習更新失敗:', error)
    }
  }

  /**
   * 分析行為模式
   */
  async analyzeBehaviorPatterns () {
    const patterns = new Map()

    // 分析行為類型頻率
    const typeFrequency = new Map()
    for (const behavior of this.behaviorHistory) {
      const count = typeFrequency.get(behavior.type) || 0
      typeFrequency.set(behavior.type, count + 1)
    }

    patterns.set('typeFrequency', Object.fromEntries(typeFrequency))

    // 分析時間模式
    const timePatterns = this.analyzeTimePatterns()
    patterns.set('timePatterns', timePatterns)

    // 分析會話模式
    const sessionPatterns = this.analyzeSessionPatterns()
    patterns.set('sessionPatterns', sessionPatterns)

    // 更新行為模式
    this.userProfile.behaviorPatterns = patterns
    this.stats.patternsDetected = patterns.size

    this.logger.log(`[CHECK] 分析了 ${patterns.size} 個行為模式`)
  }

  /**
   * 分析時間模式
   */
  analyzeTimePatterns () {
    const hourlyUsage = new Array(24).fill(0)
    const dailyUsage = new Array(7).fill(0)

    for (const behavior of this.behaviorHistory) {
      const date = new Date(behavior.timestamp)
      const hour = date.getHours()
      const day = date.getDay()

      hourlyUsage[hour]++
      dailyUsage[day]++
    }

    return {
      hourlyUsage,
      dailyUsage,
      peakHour: hourlyUsage.indexOf(Math.max(...hourlyUsage)),
      peakDay: dailyUsage.indexOf(Math.max(...dailyUsage))
    }
  }

  /**
   * 分析會話模式
   */
  analyzeSessionPatterns () {
    // 簡化的會話分析
    return {
      averageSessionLength: this.calculateAverageSessionLength(),
      commonActionSequences: this.findCommonActionSequences(),
      sessionCount: this.estimateSessionCount()
    }
  }

  /**
   * 計算平均會話長度
   */
  calculateAverageSessionLength () {
    // 簡化實現
    return this.behaviorHistory.length > 0
      ? (Date.now() - this.behaviorHistory[0].timestamp) / this.behaviorHistory.length
      : 0
  }

  /**
   * 尋找常見動作序列
   */
  findCommonActionSequences () {
    // 簡化實現，返回最近的動作序列
    return this.behaviorHistory.slice(-5).map(b => b.type)
  }

  /**
   * 估算會話數量
   */
  estimateSessionCount () {
    // 簡化實現
    return Math.ceil(this.behaviorHistory.length / 10)
  }

  /**
   * 更新使用統計
   */
  async updateUsageStatistics () {
    const stats = new Map()

    // 總使用次數
    stats.set('totalActions', this.behaviorHistory.length)

    // 最近使用時間
    stats.set('lastUsed', Date.now())

    // 使用頻率（每天）
    const daysSinceFirst = this.behaviorHistory.length > 0
      ? (Date.now() - this.behaviorHistory[0].timestamp) / (1000 * 60 * 60 * 24)
      : 0
    stats.set('dailyFrequency', daysSinceFirst > 0 ? this.behaviorHistory.length / daysSinceFirst : 0)

    this.userProfile.usageStats = stats
  }

  /**
   * 生成主題推薦
   */
  async generateThemeRecommendation () {
    const timePatterns = this.userProfile.behaviorPatterns.get('timePatterns')
    if (!timePatterns) return null

    const currentHour = new Date().getHours()

    // 根據使用時間推薦主題
    if (currentHour >= 18 || currentHour <= 6) {
      return {
        id: `theme_recommendation_${Date.now()}`,
        type: 'theme',
        title: '夜間模式建議',
        description: '根據您的使用時間，建議啟用深色主題以保護視力',
        action: {
          type: 'setTheme',
          value: 'dark'
        },
        confidence: 0.8,
        reason: 'nighttime_usage'
      }
    }

    return null
  }

  /**
   * 生成功能推薦
   */
  async generateFeatureRecommendations () {
    const recommendations = []

    // 基於使用頻率的推薦
    const typeFrequency = this.userProfile.behaviorPatterns.get('typeFrequency')
    if (typeFrequency && typeFrequency.extraction > 10) {
      recommendations.push({
        id: `feature_recommendation_${Date.now()}`,
        type: 'feature',
        title: '自動提取建議',
        description: '您經常使用提取功能，建議啟用自動提取以提升效率',
        action: {
          type: 'setPreference',
          key: 'extraction.autoExtract',
          value: true
        },
        confidence: 0.7,
        reason: 'high_extraction_usage'
      })
    }

    return recommendations
  }

  /**
   * 生成設定推薦
   */
  async generateSettingsRecommendations () {
    const recommendations = []

    // 基於行為模式的設定建議
    const sessionPatterns = this.userProfile.behaviorPatterns.get('sessionPatterns')
    if (sessionPatterns && sessionPatterns.averageSessionLength > 600000) { // 10分鐘
      recommendations.push({
        id: `settings_recommendation_${Date.now()}`,
        type: 'setting',
        title: '長時間使用優化',
        description: '檢測到您傾向長時間使用，建議調整設定以獲得更好體驗',
        action: {
          type: 'setPreference',
          key: 'ui.animation.duration',
          value: 200
        },
        confidence: 0.6,
        reason: 'long_session_usage'
      })
    }

    return recommendations
  }

  /**
   * 應用主題建議
   */
  async applyThemeSuggestion (suggestion) {
    if (this.eventBus) {
      await this.eventBus.emit('UX.THEME.CHANGE.REQUEST', {
        theme: suggestion.action.value
      })
    }

    return { applied: true, action: 'theme_changed' }
  }

  /**
   * 應用設定建議
   */
  async applySettingSuggestion (suggestion) {
    if (this.preferenceService) {
      await this.preferenceService.setPreference(
        suggestion.action.key,
        suggestion.action.value
      )
    }

    return { applied: true, action: 'preference_updated' }
  }

  /**
   * 應用功能建議
   */
  async applyFeatureSuggestion (suggestion) {
    if (this.preferenceService) {
      await this.preferenceService.setPreference(
        suggestion.action.key,
        suggestion.action.value
      )
    }

    return { applied: true, action: 'feature_enabled' }
  }

  /**
   * 生成初始推薦
   */
  async generateInitialRecommendations () {
    if (this.behaviorHistory.length >= this.learningConfig.minDataPoints) {
      await this.generatePersonalizedRecommendations()
    } else {
      this.logger.log('[WARN] 數據點不足，跳過初始推薦生成')
    }
  }

  /**
   * 開始會話追蹤
   */
  startSessionTracking () {
    this.sessionData.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.sessionData.startTime = Date.now()
    this.sessionData.actions = []

    this.logger.log(`[STATS] 開始會話追蹤: ${this.sessionData.sessionId}`)
  }

  /**
   * 獲取會話統計
   */
  getSessionStats () {
    return {
      sessionId: this.sessionData.sessionId,
      startTime: this.sessionData.startTime,
      duration: Date.now() - this.sessionData.startTime,
      actionsCount: this.sessionData.actions.length,
      learningEnabled: this.state.learningEnabled
    }
  }

  /**
   * 更新行為模式
   */
  async updateBehaviorPatterns (behaviorData) {
    // 即時更新模式（簡化實現）
    const patterns = this.userProfile.behaviorPatterns

    // 更新類型頻率
    const typeFreq = patterns.get('typeFrequency') || {}
    typeFreq[behaviorData.type] = (typeFreq[behaviorData.type] || 0) + 1
    patterns.set('typeFrequency', typeFreq)

    this.userProfile.behaviorPatterns = patterns
  }

  /**
   * 註冊事件監聽器
   */
  async registerEventListeners () {
    if (!this.eventBus) {
      this.logger.warn('[WARN] EventBus 不可用，跳過個人化事件監聽器註冊')
      return
    }

    // 監聽使用者行為記錄請求
    await this.eventBus.on('UX.USER.ACTION.RECORD.REQUEST', async (event) => {
      const { action } = event.data || {}
      if (action) {
        await this.recordUserAction(action)
      }
    })

    // 監聽個人化推薦生成請求
    await this.eventBus.on('UX.PERSONALIZATION.RECOMMENDATIONS.REQUEST', async (event) => {
      const recommendations = await this.generatePersonalizedRecommendations()

      if (this.eventBus) {
        await this.eventBus.emit('UX.PERSONALIZATION.RECOMMENDATIONS.RESPONSE', {
          requestId: event.data?.requestId,
          recommendations
        })
      }
    })

    this.logger.log('[OK] 個人化事件監聽器註冊完成')
  }

  /**
   * 獲取個人化統計
   */
  getPersonalizationStats () {
    return {
      ...this.stats,
      behaviorHistorySize: this.behaviorHistory.length,
      patternsCount: this.userProfile.behaviorPatterns.size,
      recommendationsCount: this.userProfile.recommendations.length,
      learningEnabled: this.state.learningEnabled,
      sessionStats: this.getSessionStats()
    }
  }

  /**
   * 獲取服務狀態
   */
  getStatus () {
    return {
      service: 'PersonalizationService',
      initialized: this.state.initialized,
      active: this.state.active,
      learningEnabled: this.state.learningEnabled,
      behaviorHistorySize: this.behaviorHistory.length,
      patternsDetected: this.userProfile.behaviorPatterns.size,
      stats: { ...this.stats }
    }
  }

  /**
   * 獲取健康狀態
   */
  getHealthStatus () {
    return {
      service: 'PersonalizationService',
      healthy: this.state.initialized && this.state.active,
      status: this.state.active ? 'active' : 'inactive',
      learningEnabled: this.state.learningEnabled,
      metrics: {
        behaviorRecorded: this.stats.behaviorRecorded,
        patternsDetected: this.stats.patternsDetected,
        recommendationsGenerated: this.stats.recommendationsGenerated,
        recommendationsApplied: this.stats.recommendationsApplied,
        behaviorHistorySize: this.behaviorHistory.length,
        patternsCount: this.userProfile.behaviorPatterns.size,
        recommendationsCount: this.userProfile.recommendations.length
      }
    }
  }
}

module.exports = PersonalizationService
