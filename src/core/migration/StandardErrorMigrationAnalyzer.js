/**
 * StandardError 遷移分析器
 *
 * Phase 3: 現有 StandardError 完全遷移分析工具
 *
 * 功能：
 * - 掃描專案中所有 StandardError 使用情況
 * - 評估遷移複雜度和風險
 * - 生成遷移計畫和優先級排序
 * - 提供遷移進度追蹤
 *
 * 設計原則：
 * - 漸進式遷移：低風險模組優先
 * - 向後相容：確保遷移過程零破壞性變更
 * - 自動化：盡可能自動化遷移過程
 * - 驗證機制：每步遷移都有完整測試驗證
 */

import fs from 'fs'
import path from 'path'
import { ErrorCodes } from '../errors/ErrorCodes.js'

/**
 * StandardError 使用分析器
 */
export class StandardErrorMigrationAnalyzer {
  /**
   * 遷移分析常數
   */
  static get CONSTANTS () {
    return {
      MIGRATION_PHASES: {
        ANALYSIS: 'analysis',
        PLANNING: 'planning',
        WRAPPER_CREATION: 'wrapper_creation',
        GRADUAL_MIGRATION: 'gradual_migration',
        VALIDATION: 'validation',
        CLEANUP: 'cleanup'
      },
      RISK_LEVELS: {
        LOW: 'LOW',
        MEDIUM: 'MEDIUM',
        HIGH: 'HIGH',
        CRITICAL: 'CRITICAL'
      },
      MODULE_TYPES: {
        CORE: 'core',
        UI: 'ui',
        BACKGROUND: 'background',
        CONTENT: 'content',
        STORAGE: 'storage',
        EXPORT: 'export',
        HANDLERS: 'handlers',
        TESTS: 'tests'
      }
    }
  }

  constructor (options = {}) {
    this.config = {
      projectRoot: options.projectRoot || (typeof process !== 'undefined' && process.cwd ? process.cwd() : '/'),
      srcDirectory: options.srcDirectory || 'src',
      excludePatterns: options.excludePatterns || [
        'node_modules',
        'build',
        'dist',
        'coverage',
        '*.test.js',
        '*.spec.js'
      ]
    }

    this.analysisResults = {
      totalFiles: 0,
      affectedFiles: [],
      usagePatterns: [],
      migrationPlan: [],
      riskAssessment: {},
      dependencies: new Map()
    }
  }

  /**
   * 執行完整的遷移分析
   * @returns {Object} 分析結果
   */
  async analyzeForMigration () {
    // Logger 後備方案: 開發工具進度記錄
    // 設計理念: 遷移分析工具需要清晰的執行進度提示
    // 執行環境: Node.js 開發環境，作為獨立工具運行
    // 後備機制: console.log 提供遷移分析的即時狀態反饋
    // 開發需求: 長時間運行的分析需要進度可見性
    // eslint-disable-next-line no-console
    console.log('🔍 開始 StandardError 遷移分析...\n')

    try {
      // 階段 1: 掃描檔案使用情況
      await this._scanStandardErrorUsage()

      // 階段 2: 分析使用模式
      await this._analyzeUsagePatterns()

      // 階段 3: 評估遷移風險
      await this._assessMigrationRisks()

      // 階段 4: 建立遷移計畫
      await this._createMigrationPlan()

      // 階段 5: 生成分析報告
      const report = this._generateAnalysisReport()

      // eslint-disable-next-line no-console
      console.log('✅ StandardError 遷移分析完成')
      return report
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ 遷移分析失敗:', error.message)
      throw error
    }
  }

  /**
   * 掃描 StandardError 使用情況
   * @private
   */
  async _scanStandardErrorUsage () {
    // eslint-disable-next-line no-console
    console.log('📂 掃描 StandardError 使用情況...')

    const srcPath = path.join(this.config.projectRoot, this.config.srcDirectory)
    const files = await this._getAllJavaScriptFiles(srcPath)

    this.analysisResults.totalFiles = files.length

    for (const filePath of files) {
      const relativeFilePath = path.relative(this.config.projectRoot, filePath)
      const fileContent = fs.readFileSync(filePath, 'utf8')

      const usages = this._extractStandardErrorUsages(fileContent, relativeFilePath)

      if (usages.length > 0) {
        this.analysisResults.affectedFiles.push({
          filePath: relativeFilePath,
          usages,
          moduleType: this._categorizeModule(relativeFilePath),
          complexity: this._calculateFileComplexity(fileContent, usages)
        })
      }
    }

    // eslint-disable-next-line no-console
    console.log(`   📊 掃描 ${this.analysisResults.totalFiles} 個檔案`)
    // eslint-disable-next-line no-console
    console.log(`   🎯 發現 ${this.analysisResults.affectedFiles.length} 個檔案使用 StandardError`)
  }

  /**
   * 提取檔案中的 StandardError 使用情況
   * @param {string} content - 檔案內容
   * @param {string} filePath - 檔案路徑
   * @returns {Array} 使用情況陣列
   * @private
   */
  _extractStandardErrorUsages (content, filePath) {
    const usages = []
    const lines = content.split('\n')

    lines.forEach((line, index) => {
      // 匹配 new StandardError( 模式
      const matches = line.match(/new StandardError\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]*)['"`]/g)

      if (matches) {
        matches.forEach(match => {
          // 提取錯誤代碼和訊息
          const codeMatch = match.match(/new StandardError\(\s*['"`]([^'"`]+)['"`]/)
          const messageMatch = match.match(/,\s*['"`]([^'"`]*)['"`]/)

          const errorCode = codeMatch ? codeMatch[1] : 'UNKNOWN'
          const message = messageMatch ? messageMatch[1] : ''

          usages.push({
            lineNumber: index + 1,
            lineContent: line.trim(),
            errorCode,
            message,
            originalPattern: match,
            suggestedMigration: this._suggestErrorCodesMigration(errorCode)
          })
        })
      }

      // 也檢查 throw 語句
      if (line.includes('throw new StandardError')) {
        // 已經在上面處理了
      }
    })

    return usages
  }

  /**
   * 建議 ErrorCodes 遷移
   * @param {string} standardErrorCode - StandardError 代碼
   * @returns {Object} 遷移建議
   * @private
   */
  _suggestErrorCodesMigration (standardErrorCode) {
    // 基於現有的映射邏輯建議遷移
    const migrationMap = {
      // 驗證錯誤
      VALIDATION_ERROR: ErrorCodes.VALIDATION_ERROR,
      REQUIRED_FIELD_MISSING: ErrorCodes.VALIDATION_ERROR,
      INVALID_FORMAT: ErrorCodes.VALIDATION_ERROR,

      // 操作錯誤
      OPERATION_FAILED: ErrorCodes.OPERATION_ERROR,
      OPERATION_TIMEOUT: ErrorCodes.TIMEOUT_ERROR,

      // 配置錯誤
      CONFIGURATION_ERROR: ErrorCodes.OPERATION_ERROR,
      EVENTBUS_NOT_CONFIGURED: ErrorCodes.OPERATION_ERROR,

      // 資源錯誤
      RESOURCE_NOT_AVAILABLE: ErrorCodes.OPERATION_ERROR,
      RESOURCE_NOT_FOUND: ErrorCodes.OPERATION_ERROR,

      // 網路錯誤
      NETWORK_ERROR: ErrorCodes.NETWORK_ERROR,
      CONNECTION_FAILED: ErrorCodes.CONNECTION_ERROR,

      // DOM 錯誤
      DOM_ERROR: ErrorCodes.DOM_ERROR,
      DOM_ELEMENT_NOT_FOUND: ErrorCodes.DOM_ERROR,

      // 儲存錯誤
      STORAGE_ERROR: ErrorCodes.STORAGE_ERROR,
      STORAGE_QUOTA_EXCEEDED: ErrorCodes.STORAGE_ERROR,

      // Chrome Extension 錯誤
      CHROME_API_ERROR: ErrorCodes.CHROME_ERROR,
      PERMISSION_DENIED: ErrorCodes.CHROME_ERROR,

      // 書籍相關錯誤
      BOOK_ERROR: ErrorCodes.BOOK_ERROR,
      BOOK_NOT_FOUND: ErrorCodes.BOOK_ERROR,

      // 未知錯誤
      UNKNOWN_ERROR: ErrorCodes.UNKNOWN_ERROR
    }

    const targetErrorCode = migrationMap[standardErrorCode] || ErrorCodes.UNKNOWN_ERROR

    return {
      targetErrorCode,
      confidence: migrationMap[standardErrorCode] ? 'HIGH' : 'MEDIUM',
      strategy: this._determineMigrationStrategy(standardErrorCode, targetErrorCode)
    }
  }

  /**
   * 決定遷移策略
   * @param {string} sourceCode - 原始錯誤代碼
   * @param {string} targetCode - 目標錯誤代碼
   * @returns {string} 遷移策略
   * @private
   */
  _determineMigrationStrategy (sourceCode, targetCode) {
    if (sourceCode === 'UNKNOWN_ERROR') {
      return 'DIRECT_REPLACEMENT' // 直接替換
    }

    if (targetCode === ErrorCodes.UNKNOWN_ERROR) {
      return 'NEEDS_REVIEW' // 需要人工檢查
    }

    return 'ADAPTER_MIGRATION' // 使用適配器遷移
  }

  /**
   * 分析使用模式
   * @private
   */
  async _analyzeUsagePatterns () {
    // eslint-disable-next-line no-console
    console.log('📈 分析使用模式...')

    const patterns = {
      mostCommonErrors: {},
      moduleDistribution: {},
      complexityDistribution: { low: 0, medium: 0, high: 0 },
      migrationStrategies: {}
    }

    // 統計最常見的錯誤類型
    this.analysisResults.affectedFiles.forEach(file => {
      file.usages.forEach(usage => {
        patterns.mostCommonErrors[usage.errorCode] =
          (patterns.mostCommonErrors[usage.errorCode] || 0) + 1

        patterns.migrationStrategies[usage.suggestedMigration.strategy] =
          (patterns.migrationStrategies[usage.suggestedMigration.strategy] || 0) + 1
      })

      // 模組分布
      patterns.moduleDistribution[file.moduleType] =
        (patterns.moduleDistribution[file.moduleType] || 0) + 1

      // 複雜度分布
      patterns.complexityDistribution[file.complexity]++
    })

    this.analysisResults.usagePatterns = patterns

    // eslint-disable-next-line no-console
    console.log('   📊 最常見錯誤類型:')
    Object.entries(patterns.mostCommonErrors)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .forEach(([code, count]) => {
        // eslint-disable-next-line no-console
        console.log(`      ${code}: ${count} 次`)
      })
  }

  /**
   * 評估遷移風險
   * @private
   */
  async _assessMigrationRisks () {
    // eslint-disable-next-line no-console
    console.log('⚠️  評估遷移風險...')

    const riskFactors = {
      fileComplexity: 0,
      moduleInterdependency: 0,
      testCoverage: 0,
      criticalPath: 0
    }

    // 評估檔案複雜度風險
    this.analysisResults.affectedFiles.forEach(file => {
      switch (file.complexity) {
        case 'high':
          riskFactors.fileComplexity += 3
          break
        case 'medium':
          riskFactors.fileComplexity += 2
          break
        case 'low':
          riskFactors.fileComplexity += 1
          break
      }

      // 檢查是否為關鍵路徑模組
      if (this._isCriticalModule(file.filePath)) {
        riskFactors.criticalPath += 5
      }
    })

    // 計算總體風險等級
    const totalRisk = Object.values(riskFactors).reduce((sum, risk) => sum + risk, 0)
    const averageRisk = totalRisk / this.analysisResults.affectedFiles.length

    let overallRiskLevel
    if (averageRisk < 2) {
      overallRiskLevel = this.constructor.CONSTANTS.RISK_LEVELS.LOW
    } else if (averageRisk < 4) {
      overallRiskLevel = this.constructor.CONSTANTS.RISK_LEVELS.MEDIUM
    } else if (averageRisk < 6) {
      overallRiskLevel = this.constructor.CONSTANTS.RISK_LEVELS.HIGH
    } else {
      overallRiskLevel = this.constructor.CONSTANTS.RISK_LEVELS.CRITICAL
    }

    this.analysisResults.riskAssessment = {
      riskFactors,
      totalRisk,
      averageRisk,
      overallRiskLevel,
      recommendations: this._generateRiskRecommendations(overallRiskLevel)
    }

    // eslint-disable-next-line no-console
    console.log(`   📊 整體風險等級: ${overallRiskLevel}`)
    // eslint-disable-next-line no-console
    console.log(`   🎯 平均風險分數: ${averageRisk.toFixed(2)}`)
  }

  /**
   * 建立遷移計畫
   * @private
   */
  async _createMigrationPlan () {
    // eslint-disable-next-line no-console
    console.log('📋 建立遷移計畫...')

    // 按風險和複雜度排序檔案
    const sortedFiles = [...this.analysisResults.affectedFiles].sort((a, b) => {
      const complexityWeight = { low: 1, medium: 2, high: 3 }
      const moduleWeight = {
        tests: 0.5,
        handlers: 1,
        ui: 1.5,
        storage: 2,
        content: 2.5,
        background: 3,
        core: 3.5
      }

      const aWeight = complexityWeight[a.complexity] + (moduleWeight[a.moduleType] || 2)
      const bWeight = complexityWeight[b.complexity] + (moduleWeight[b.moduleType] || 2)

      return aWeight - bWeight
    })

    // 建立分階段遷移計畫
    const phases = []
    let currentPhase = []
    let currentPhaseComplexity = 0

    sortedFiles.forEach(file => {
      const fileWeight = this._calculateMigrationWeight(file)

      // 如果當前階段複雜度過高，開始新階段
      if (currentPhaseComplexity + fileWeight > 10 && currentPhase.length > 0) {
        phases.push({
          phase: phases.length + 1,
          files: [...currentPhase],
          estimatedEffort: this._estimatePhaseEffort(currentPhase),
          riskLevel: this._calculatePhaseRisk(currentPhase)
        })

        currentPhase = []
        currentPhaseComplexity = 0
      }

      currentPhase.push(file)
      currentPhaseComplexity += fileWeight
    })

    // 加入最後一個階段
    if (currentPhase.length > 0) {
      phases.push({
        phase: phases.length + 1,
        files: [...currentPhase],
        estimatedEffort: this._estimatePhaseEffort(currentPhase),
        riskLevel: this._calculatePhaseRisk(currentPhase)
      })
    }

    this.analysisResults.migrationPlan = phases

    // eslint-disable-next-line no-console
    console.log(`   📊 建立 ${phases.length} 個遷移階段`)
    phases.forEach(phase => {
      // eslint-disable-next-line no-console
      console.log(`      階段 ${phase.phase}: ${phase.files.length} 檔案 (風險: ${phase.riskLevel})`)
    })
  }

  /**
   * 生成分析報告
   * @returns {Object} 完整分析報告
   * @private
   */
  _generateAnalysisReport () {
    const report = {
      summary: {
        timestamp: new Date().toISOString(),
        totalFiles: this.analysisResults.totalFiles,
        affectedFiles: this.analysisResults.affectedFiles.length,
        totalUsages: this.analysisResults.affectedFiles.reduce(
          (sum, file) => sum + file.usages.length, 0
        ),
        overallRiskLevel: this.analysisResults.riskAssessment.overallRiskLevel,
        migrationPhases: this.analysisResults.migrationPlan.length
      },
      detailedAnalysis: {
        usagePatterns: this.analysisResults.usagePatterns,
        riskAssessment: this.analysisResults.riskAssessment,
        migrationPlan: this.analysisResults.migrationPlan
      },
      recommendations: this._generateMigrationRecommendations(),
      nextSteps: this._generateNextSteps()
    }

    return report
  }

  /**
   * 生成遷移建議
   * @returns {Array} 建議列表
   * @private
   */
  _generateMigrationRecommendations () {
    const recommendations = []

    // 基於風險等級的建議
    switch (this.analysisResults.riskAssessment.overallRiskLevel) {
      case 'LOW':
        recommendations.push('建議採用快速自動化遷移策略')
        recommendations.push('可以並行處理多個模組')
        break
      case 'MEDIUM':
        recommendations.push('建議採用分階段謹慎遷移')
        recommendations.push('每階段完成後進行完整測試')
        break
      case 'HIGH':
        recommendations.push('建議優先建立完整的向後相容包裝器')
        recommendations.push('逐一遷移並進行密集測試')
        break
      case 'CRITICAL':
        recommendations.push('建議暫緩遷移，先進行代碼重構')
        recommendations.push('需要建立更全面的測試覆蓋')
        break
    }

    // 基於使用模式的建議
    const patterns = this.analysisResults.usagePatterns
    if (patterns.migrationStrategies.NEEDS_REVIEW > patterns.migrationStrategies.ADAPTER_MIGRATION) {
      recommendations.push('建議優先處理需要人工檢查的錯誤類型')
    }

    return recommendations
  }

  /**
   * 生成下一步行動
   * @returns {Array} 行動項目
   * @private
   */
  _generateNextSteps () {
    return [
      '1. 建立 StandardError 到 ErrorCodes 的向後相容包裝器',
      '2. 實作自動化遷移工具',
      '3. 建立遷移測試套件',
      '4. 執行第一階段遷移（低風險模組）',
      '5. 驗證遷移結果並調整策略',
      '6. 繼續後續階段的遷移'
    ]
  }

  // 輔助方法實作

  async _getAllJavaScriptFiles (directory) {
    const files = []
    const entries = fs.readdirSync(directory, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name)

      if (entry.isDirectory() && !this._isExcludedPath(entry.name)) {
        const subFiles = await this._getAllJavaScriptFiles(fullPath)
        files.push(...subFiles)
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        files.push(fullPath)
      }
    }

    return files
  }

  _isExcludedPath (pathName) {
    return this.config.excludePatterns.some(pattern =>
      pathName.includes(pattern.replace('*', ''))
    )
  }

  _categorizeModule (filePath) {
    const { MODULE_TYPES } = this.constructor.CONSTANTS

    if (filePath.includes('/core/')) return MODULE_TYPES.CORE
    if (filePath.includes('/ui/')) return MODULE_TYPES.UI
    if (filePath.includes('/background/')) return MODULE_TYPES.BACKGROUND
    if (filePath.includes('/content/')) return MODULE_TYPES.CONTENT
    if (filePath.includes('/storage/')) return MODULE_TYPES.STORAGE
    if (filePath.includes('/export/')) return MODULE_TYPES.EXPORT
    if (filePath.includes('/handlers/')) return MODULE_TYPES.HANDLERS
    if (filePath.includes('.test.js') || filePath.includes('.spec.js')) return MODULE_TYPES.TESTS

    return 'other'
  }

  _calculateFileComplexity (content, usages) {
    const lines = content.split('\n').length
    const usageCount = usages.length
    const complexPatterns = (content.match(/try|catch|async|await|Promise/g) || []).length

    const complexityScore = lines / 100 + usageCount * 2 + complexPatterns

    if (complexityScore < 5) return 'low'
    if (complexityScore < 15) return 'medium'
    return 'high'
  }

  _isCriticalModule (filePath) {
    const criticalPaths = [
      '/core/errors/',
      '/background/service-worker',
      '/error-handling/',
      '/core/event'
    ]

    return criticalPaths.some(path => filePath.includes(path))
  }

  _generateRiskRecommendations (riskLevel) {
    const baseRecommendations = {
      LOW: ['可以採用自動化遷移工具', '並行處理多個模組'],
      MEDIUM: ['分階段遷移', '加強測試覆蓋'],
      HIGH: ['建立完整包裝器', '逐一手動遷移'],
      CRITICAL: ['暫緩遷移', '先重構代碼']
    }

    return baseRecommendations[riskLevel] || []
  }

  _calculateMigrationWeight (file) {
    const complexityWeight = { low: 1, medium: 3, high: 5 }
    const moduleWeight = {
      tests: 0.5,
      handlers: 1,
      ui: 2,
      storage: 3,
      content: 3,
      background: 4,
      core: 5
    }

    return complexityWeight[file.complexity] +
           (moduleWeight[file.moduleType] || 2) +
           file.usages.length * 0.5
  }

  _estimatePhaseEffort (files) {
    const totalWeight = files.reduce((sum, file) =>
      sum + this._calculateMigrationWeight(file), 0)

    if (totalWeight < 10) return 'LOW'
    if (totalWeight < 25) return 'MEDIUM'
    return 'HIGH'
  }

  _calculatePhaseRisk (files) {
    const hasHighComplexity = files.some(file => file.complexity === 'high')
    const hasCriticalModule = files.some(file => this._isCriticalModule(file.filePath))
    const avgUsages = files.reduce((sum, file) => sum + file.usages.length, 0) / files.length

    if (hasCriticalModule || hasHighComplexity || avgUsages > 10) return 'HIGH'
    if (avgUsages > 5) return 'MEDIUM'
    return 'LOW'
  }
}
