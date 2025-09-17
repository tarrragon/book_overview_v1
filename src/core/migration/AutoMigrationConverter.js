/**
 * ErrorCodes 自動遷移轉換器
 *
 * 功能：
 * - 自動掃描並轉換 StandardError 使用
 * - 提供程式碼轉換建議和自動化修正
 * - 支援分階段遷移策略
 * - 產生遷移報告和風險評估
 *
 * Phase 3: StandardError 自動轉換機制實作
 */

const fs = require('fs').promises
const path = require('path')

/**
 * 轉換模式定義
 */
const CONVERSION_MODES = {
  SCAN_ONLY: 'scan_only',           // 僅掃描，不進行轉換
  SUGGEST_ONLY: 'suggest_only',     // 產生轉換建議
  AUTO_CONVERT: 'auto_convert',     // 自動轉換
  MANUAL_ASSIST: 'manual_assist'    // 輔助手動轉換
}

/**
 * 轉換風險等級
 */
const CONVERSION_RISKS = {
  LOW: 'low',                       // 安全轉換
  MEDIUM: 'medium',                 // 需要驗證
  HIGH: 'high',                     // 需要人工確認
  CRITICAL: 'critical'              // 不建議自動轉換
}

/**
 * 程式碼轉換模式
 */
const CODE_PATTERNS = {
  // StandardError 建構函式使用
  CONSTRUCTOR_USAGE: {
    pattern: /new\s+StandardError\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]*)['"`](?:\s*,\s*({[^}]*}))?\s*\)/g,
    description: 'StandardError 建構函式使用'
  },

  // StandardError 匯入語句
  IMPORT_STATEMENT: {
    pattern: /(?:import|const|let|var)\s+(?:{[^}]*StandardError[^}]*}|StandardError)\s+(?:=\s*require\(|from)\s*['"`]([^'"`]+)['"`]/g,
    description: 'StandardError 匯入語句'
  },

  // throw StandardError 語句
  THROW_STATEMENT: {
    pattern: /throw\s+new\s+StandardError\s*\([^)]+\)/g,
    description: 'throw StandardError 語句'
  },

  // catch 中的 StandardError 處理
  CATCH_HANDLING: {
    pattern: /catch\s*\(\s*(\w+)\s*\)\s*{[^}]*\1\.code[^}]*}/g,
    description: 'catch 中的 StandardError 處理'
  },

  // error.code 屬性存取
  CODE_ACCESS: {
    pattern: /(\w+)\.code(?:\s*===?\s*['"`]([^'"`]+)['"`])?/g,
    description: 'error.code 屬性存取'
  }
}

/**
 * 自動遷移轉換器
 */
class AutoMigrationConverter {
  constructor(options = {}) {
    this.config = {
      mode: options.mode || CONVERSION_MODES.SUGGEST_ONLY,
      sourceDir: options.sourceDir || 'src',
      excludePatterns: options.excludePatterns || ['node_modules', 'dist', '.git'],
      includeExtensions: options.includeExtensions || ['.js', '.ts'],
      backupBeforeConvert: options.backupBeforeConvert !== false,
      reportPath: options.reportPath || 'docs/migration-reports',
      riskThreshold: options.riskThreshold || CONVERSION_RISKS.MEDIUM
    }

    this.conversionResults = {
      scannedFiles: [],
      conversionCandidates: [],
      suggestions: [],
      risks: [],
      statistics: {
        totalFiles: 0,
        affectedFiles: 0,
        conversionOpportunities: 0,
        riskDistribution: new Map()
      }
    }

    this.conversionStrategies = new Map()
    this._initializeConversionStrategies()
  }

  /**
   * 初始化轉換策略
   * @private
   */
  _initializeConversionStrategies() {
    // StandardError 建構函式轉換策略
    this.conversionStrategies.set('constructor', {
      pattern: CODE_PATTERNS.CONSTRUCTOR_USAGE.pattern,
      risk: CONVERSION_RISKS.LOW,
      converter: this._convertConstructorUsage.bind(this),
      description: '轉換 StandardError 建構函式為 ErrorCodes 格式'
    })

    // 匯入語句轉換策略
    this.conversionStrategies.set('import', {
      pattern: CODE_PATTERNS.IMPORT_STATEMENT.pattern,
      risk: CONVERSION_RISKS.MEDIUM,
      converter: this._convertImportStatement.bind(this),
      description: '更新匯入語句以包含 ErrorCodes 支援'
    })

    // Throw 語句轉換策略
    this.conversionStrategies.set('throw', {
      pattern: CODE_PATTERNS.THROW_STATEMENT.pattern,
      risk: CONVERSION_RISKS.LOW,
      converter: this._convertThrowStatement.bind(this),
      description: '轉換 throw StandardError 語句'
    })

    // 錯誤處理轉換策略
    this.conversionStrategies.set('errorHandling', {
      pattern: CODE_PATTERNS.CATCH_HANDLING.pattern,
      risk: CONVERSION_RISKS.HIGH,
      converter: this._convertErrorHandling.bind(this),
      description: '轉換錯誤處理邏輯以支援新的錯誤格式'
    })

    // 屬性存取轉換策略
    this.conversionStrategies.set('codeAccess', {
      pattern: CODE_PATTERNS.CODE_ACCESS.pattern,
      risk: CONVERSION_RISKS.MEDIUM,
      converter: this._convertCodeAccess.bind(this),
      description: '轉換 error.code 屬性存取'
    })
  }

  /**
   * 執行自動遷移轉換
   * @returns {Object} 轉換結果
   */
  async executeAutoConversion() {
    console.log('🚀 開始執行 StandardError 自動遷移轉換...')

    try {
      // 1. 掃描原始碼檔案
      await this._scanSourceFiles()

      // 2. 分析轉換機會
      await this._analyzeConversionOpportunities()

      // 3. 評估轉換風險
      await this._assessConversionRisks()

      // 4. 根據模式執行轉換
      await this._executeConversionByMode()

      // 5. 產生轉換報告
      const report = await this._generateConversionReport()

      console.log('✅ StandardError 自動遷移轉換完成')
      return report

    } catch (error) {
      console.error('❌ 自動遷移轉換失敗:', error)
      throw error
    }
  }

  /**
   * 掃描原始碼檔案
   * @private
   */
  async _scanSourceFiles() {
    console.log('📁 掃描原始碼檔案...')

    const files = await this._getSourceFiles(this.config.sourceDir)
    this.conversionResults.statistics.totalFiles = files.length

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf8')
        const fileInfo = {
          path: filePath,
          content,
          size: content.length,
          hasStandardError: this._containsStandardError(content),
          patterns: this._detectPatterns(content)
        }

        this.conversionResults.scannedFiles.push(fileInfo)

        if (fileInfo.hasStandardError) {
          this.conversionResults.statistics.affectedFiles++
        }

      } catch (error) {
        console.warn(`⚠️ 無法讀取檔案 ${filePath}:`, error.message)
      }
    }

    console.log(`📊 掃描完成: ${this.conversionResults.statistics.totalFiles} 個檔案，${this.conversionResults.statistics.affectedFiles} 個包含 StandardError`)
  }

  /**
   * 取得原始碼檔案清單
   * @param {string} dir - 目錄路徑
   * @returns {Array} 檔案路徑清單
   * @private
   */
  async _getSourceFiles(dir) {
    const files = []

    const scanDirectory = async (dirPath) => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)

        if (entry.isDirectory()) {
          // 跳過排除的目錄
          if (!this.config.excludePatterns.some(pattern => fullPath.includes(pattern))) {
            await scanDirectory(fullPath)
          }
        } else if (entry.isFile()) {
          // 檢查檔案副檔名
          const ext = path.extname(entry.name)
          if (this.config.includeExtensions.includes(ext)) {
            files.push(fullPath)
          }
        }
      }
    }

    await scanDirectory(dir)
    return files
  }

  /**
   * 檢查檔案是否包含 StandardError
   * @param {string} content - 檔案內容
   * @returns {boolean} 是否包含 StandardError
   * @private
   */
  _containsStandardError(content) {
    return /StandardError/.test(content)
  }

  /**
   * 偵測程式碼模式
   * @param {string} content - 檔案內容
   * @returns {Array} 偵測到的模式
   * @private
   */
  _detectPatterns(content) {
    const detectedPatterns = []

    for (const [strategyName, strategy] of this.conversionStrategies) {
      const matches = Array.from(content.matchAll(strategy.pattern))
      if (matches.length > 0) {
        detectedPatterns.push({
          strategy: strategyName,
          matches: matches.length,
          risk: strategy.risk,
          description: strategy.description,
          examples: matches.slice(0, 3).map(match => ({
            text: match[0],
            position: match.index
          }))
        })
      }
    }

    return detectedPatterns
  }

  /**
   * 分析轉換機會
   * @private
   */
  async _analyzeConversionOpportunities() {
    console.log('🔍 分析轉換機會...')

    for (const fileInfo of this.conversionResults.scannedFiles) {
      if (!fileInfo.hasStandardError) continue

      const opportunities = []

      for (const pattern of fileInfo.patterns) {
        const opportunity = {
          file: fileInfo.path,
          strategy: pattern.strategy,
          risk: pattern.risk,
          description: pattern.description,
          matchCount: pattern.matches,
          examples: pattern.examples,
          autoConvertible: this._isAutoConvertible(pattern.risk),
          suggestions: this._generateConversionSuggestions(pattern)
        }

        opportunities.push(opportunity)
        this.conversionResults.statistics.conversionOpportunities++
      }

      if (opportunities.length > 0) {
        this.conversionResults.conversionCandidates.push({
          file: fileInfo.path,
          opportunities
        })
      }
    }

    console.log(`🎯 發現 ${this.conversionResults.statistics.conversionOpportunities} 個轉換機會`)
  }

  /**
   * 檢查是否適合自動轉換
   * @param {string} risk - 風險等級
   * @returns {boolean} 是否適合自動轉換
   * @private
   */
  _isAutoConvertible(risk) {
    const riskOrder = [CONVERSION_RISKS.LOW, CONVERSION_RISKS.MEDIUM, CONVERSION_RISKS.HIGH, CONVERSION_RISKS.CRITICAL]
    const thresholdIndex = riskOrder.indexOf(this.config.riskThreshold)
    const riskIndex = riskOrder.indexOf(risk)

    return riskIndex <= thresholdIndex
  }

  /**
   * 產生轉換建議
   * @param {Object} pattern - 偵測到的模式
   * @returns {Array} 轉換建議
   * @private
   */
  _generateConversionSuggestions(pattern) {
    const suggestions = []

    switch (pattern.strategy) {
      case 'constructor':
        suggestions.push('將 StandardError 建構函式改為使用 StandardError')
        suggestions.push('考慮直接使用對應的 ErrorCodes')
        break

      case 'import':
        suggestions.push('更新匯入語句以包含 StandardError')
        suggestions.push('確保 ErrorCodes 也被正確匯入')
        break

      case 'throw':
        suggestions.push('使用 StandardError 包裝拋出的錯誤')
        suggestions.push('檢查錯誤訊息格式是否需要調整')
        break

      case 'errorHandling':
        suggestions.push('更新錯誤處理邏輯以支援新的錯誤格式')
        suggestions.push('考慮同時檢查 errorCode 和 code 屬性')
        break

      case 'codeAccess':
        suggestions.push('考慮使用 errorCode 屬性替代 code')
        suggestions.push('確保錯誤比較邏輯的相容性')
        break
    }

    return suggestions
  }

  /**
   * 評估轉換風險
   * @private
   */
  async _assessConversionRisks() {
    console.log('⚠️ 評估轉換風險...')

    for (const candidate of this.conversionResults.conversionCandidates) {
      for (const opportunity of candidate.opportunities) {
        const risk = this._calculateDetailedRisk(opportunity)
        this.conversionResults.risks.push(risk)

        // 更新風險分布統計
        const riskLevel = risk.level
        this.conversionResults.statistics.riskDistribution.set(
          riskLevel,
          (this.conversionResults.statistics.riskDistribution.get(riskLevel) || 0) + 1
        )
      }
    }

    console.log('📊 風險評估完成')
  }

  /**
   * 計算詳細風險
   * @param {Object} opportunity - 轉換機會
   * @returns {Object} 風險詳情
   * @private
   */
  _calculateDetailedRisk(opportunity) {
    const baseRisk = opportunity.risk
    let adjustedRisk = baseRisk

    // 根據檔案類型調整風險
    if (opportunity.file.includes('test')) {
      adjustedRisk = this._lowerRisk(adjustedRisk) // 測試檔案風險較低
    } else if (opportunity.file.includes('core')) {
      adjustedRisk = this._raiseRisk(adjustedRisk) // 核心檔案風險較高
    }

    // 根據使用頻率調整風險
    if (opportunity.matchCount > 10) {
      adjustedRisk = this._raiseRisk(adjustedRisk) // 大量使用提高風險
    }

    return {
      file: opportunity.file,
      strategy: opportunity.strategy,
      level: adjustedRisk,
      originalLevel: baseRisk,
      factors: this._identifyRiskFactors(opportunity),
      mitigation: this._suggestRiskMitigation(adjustedRisk),
      priority: this._calculatePriority(adjustedRisk, opportunity.matchCount)
    }
  }

  /**
   * 降低風險等級
   * @param {string} risk - 目前風險等級
   * @returns {string} 降低後的風險等級
   * @private
   */
  _lowerRisk(risk) {
    const risks = [CONVERSION_RISKS.CRITICAL, CONVERSION_RISKS.HIGH, CONVERSION_RISKS.MEDIUM, CONVERSION_RISKS.LOW]
    const index = risks.indexOf(risk)
    return index < risks.length - 1 ? risks[index + 1] : risk
  }

  /**
   * 提高風險等級
   * @param {string} risk - 目前風險等級
   * @returns {string} 提高後的風險等級
   * @private
   */
  _raiseRisk(risk) {
    const risks = [CONVERSION_RISKS.LOW, CONVERSION_RISKS.MEDIUM, CONVERSION_RISKS.HIGH, CONVERSION_RISKS.CRITICAL]
    const index = risks.indexOf(risk)
    return index < risks.length - 1 ? risks[index + 1] : risk
  }

  /**
   * 識別風險因子
   * @param {Object} opportunity - 轉換機會
   * @returns {Array} 風險因子清單
   * @private
   */
  _identifyRiskFactors(opportunity) {
    const factors = []

    if (opportunity.file.includes('core')) {
      factors.push('核心系統檔案')
    }

    if (opportunity.matchCount > 10) {
      factors.push('大量使用 (>10 處)')
    }

    if (opportunity.strategy === 'errorHandling') {
      factors.push('複雜錯誤處理邏輯')
    }

    if (opportunity.file.includes('background')) {
      factors.push('背景服務處理')
    }

    return factors
  }

  /**
   * 建議風險緩解措施
   * @param {string} risk - 風險等級
   * @returns {Array} 緩解措施建議
   * @private
   */
  _suggestRiskMitigation(risk) {
    const mitigations = []

    switch (risk) {
      case CONVERSION_RISKS.LOW:
        mitigations.push('可以安全地自動轉換')
        mitigations.push('建議執行轉換後測試')
        break

      case CONVERSION_RISKS.MEDIUM:
        mitigations.push('建議先在開發環境測試')
        mitigations.push('確保有完整的單元測試覆蓋')
        break

      case CONVERSION_RISKS.HIGH:
        mitigations.push('需要人工檢查轉換結果')
        mitigations.push('建議分階段轉換')
        mitigations.push('執行完整的整合測試')
        break

      case CONVERSION_RISKS.CRITICAL:
        mitigations.push('不建議自動轉換')
        mitigations.push('需要專人評估和手動轉換')
        mitigations.push('必須建立回滾機制')
        break
    }

    return mitigations
  }

  /**
   * 計算轉換優先級
   * @param {string} risk - 風險等級
   * @param {number} usage - 使用次數
   * @returns {number} 優先級分數 (1-10)
   * @private
   */
  _calculatePriority(risk, usage) {
    const riskScores = {
      [CONVERSION_RISKS.LOW]: 8,
      [CONVERSION_RISKS.MEDIUM]: 6,
      [CONVERSION_RISKS.HIGH]: 4,
      [CONVERSION_RISKS.CRITICAL]: 2
    }

    const usageScore = Math.min(usage / 5, 2) // 最多加 2 分
    return Math.min(10, riskScores[risk] + usageScore)
  }

  /**
   * 根據模式執行轉換
   * @private
   */
  async _executeConversionByMode() {
    console.log(`🔧 執行轉換 (模式: ${this.config.mode})...`)

    switch (this.config.mode) {
      case CONVERSION_MODES.SCAN_ONLY:
        console.log('📋 僅掃描模式 - 跳過實際轉換')
        break

      case CONVERSION_MODES.SUGGEST_ONLY:
        await this._generateSuggestions()
        break

      case CONVERSION_MODES.AUTO_CONVERT:
        await this._performAutoConversion()
        break

      case CONVERSION_MODES.MANUAL_ASSIST:
        await this._prepareManualAssistance()
        break

      default:
        throw new Error(`未知的轉換模式: ${this.config.mode}`)
    }
  }

  /**
   * 產生轉換建議
   * @private
   */
  async _generateSuggestions() {
    console.log('💡 產生轉換建議...')

    for (const candidate of this.conversionResults.conversionCandidates) {
      for (const opportunity of candidate.opportunities) {
        const suggestion = {
          file: opportunity.file,
          type: opportunity.strategy,
          risk: opportunity.risk,
          description: opportunity.description,
          suggestions: opportunity.suggestions,
          priority: this._calculatePriority(opportunity.risk, opportunity.matchCount),
          autoConvertible: opportunity.autoConvertible,
          estimatedEffort: this._estimateConversionEffort(opportunity)
        }

        this.conversionResults.suggestions.push(suggestion)
      }
    }

    // 按優先級排序建議
    this.conversionResults.suggestions.sort((a, b) => b.priority - a.priority)

    console.log(`💡 產生了 ${this.conversionResults.suggestions.length} 個轉換建議`)
  }

  /**
   * 估算轉換工作量
   * @param {Object} opportunity - 轉換機會
   * @returns {string} 工作量估算
   * @private
   */
  _estimateConversionEffort(opportunity) {
    const baseEffort = {
      constructor: '低',
      import: '低',
      throw: '低',
      errorHandling: '高',
      codeAccess: '中'
    }

    // 調試輸出
    if (!baseEffort[opportunity.strategy]) {
      console.warn(`⚠️ 未知的策略類型: ${opportunity.strategy}`)
    }

    const effort = baseEffort[opportunity.strategy] || '中'

    if (opportunity.matchCount > 10) {
      return effort === '低' ? '中' : effort === '中' ? '高' : '很高'
    }

    return effort
  }

  /**
   * 執行自動轉換
   * @private
   */
  async _performAutoConversion() {
    console.log('🤖 執行自動轉換...')

    let convertedFiles = 0
    let convertedItems = 0

    for (const candidate of this.conversionResults.conversionCandidates) {
      const autoConvertibleOpportunities = candidate.opportunities.filter(opp => opp.autoConvertible)

      if (autoConvertibleOpportunities.length === 0) {
        continue
      }

      try {
        // 備份原始檔案
        if (this.config.backupBeforeConvert) {
          await this._backupFile(candidate.file)
        }

        // 執行轉換
        const result = await this._convertFile(candidate.file, autoConvertibleOpportunities)

        if (result.success) {
          convertedFiles++
          convertedItems += result.convertedItems
          console.log(`✅ 轉換完成: ${candidate.file} (${result.convertedItems} 項)`)
        } else {
          console.warn(`⚠️ 轉換失敗: ${candidate.file} - ${result.error}`)
        }

      } catch (error) {
        console.error(`❌ 轉換檔案時發生錯誤 ${candidate.file}:`, error.message)
      }
    }

    console.log(`🎉 自動轉換完成: ${convertedFiles} 個檔案，共 ${convertedItems} 項轉換`)
  }

  /**
   * 備份檔案
   * @param {string} filePath - 檔案路徑
   * @private
   */
  async _backupFile(filePath) {
    const backupDir = path.join(this.config.reportPath, 'backups')
    await fs.mkdir(backupDir, { recursive: true })

    const backupPath = path.join(backupDir, `${path.basename(filePath)}.backup.${Date.now()}`)
    await fs.copyFile(filePath, backupPath)
  }

  /**
   * 轉換檔案
   * @param {string} filePath - 檔案路徑
   * @param {Array} opportunities - 轉換機會
   * @returns {Object} 轉換結果
   * @private
   */
  async _convertFile(filePath, opportunities) {
    const content = await fs.readFile(filePath, 'utf8')
    let convertedContent = content
    let convertedItems = 0

    for (const opportunity of opportunities) {
      const strategy = this.conversionStrategies.get(opportunity.strategy)
      if (strategy && strategy.converter) {
        const result = strategy.converter(convertedContent, opportunity)
        if (result.converted) {
          convertedContent = result.content
          convertedItems += result.count || 1
        }
      }
    }

    if (convertedItems > 0) {
      await fs.writeFile(filePath, convertedContent, 'utf8')
    }

    return {
      success: true,
      convertedItems,
      originalSize: content.length,
      newSize: convertedContent.length
    }
  }

  /**
   * 轉換建構函式使用
   * @param {string} content - 檔案內容
   * @param {Object} opportunity - 轉換機會
   * @returns {Object} 轉換結果
   * @private
   */
  _convertConstructorUsage(content, opportunity) {
    const pattern = CODE_PATTERNS.CONSTRUCTOR_USAGE.pattern
    let count = 0

    const convertedContent = content.replace(pattern, (match, code, message, details) => {
      count++
      const detailsStr = details ? `, ${details}` : ''
      return `new StandardError('${code}', '${message}'${detailsStr})`
    })

    return {
      converted: count > 0,
      content: convertedContent,
      count
    }
  }

  /**
   * 轉換匯入語句
   * @param {string} content - 檔案內容
   * @param {Object} opportunity - 轉換機會
   * @returns {Object} 轉換結果
   * @private
   */
  _convertImportStatement(content, opportunity) {
    let count = 0

    // 簡化的匯入轉換 - 添加 StandardError 匯入
    const lines = content.split('\n')
    const convertedLines = lines.map(line => {
      if (/import.*StandardError/.test(line) && !line.includes('StandardError')) {
        count++
        return line.replace('StandardError', 'StandardError, StandardError')
      }
      return line
    })

    return {
      converted: count > 0,
      content: convertedLines.join('\n'),
      count
    }
  }

  /**
   * 轉換 throw 語句
   * @param {string} content - 檔案內容
   * @param {Object} opportunity - 轉換機會
   * @returns {Object} 轉換結果
   * @private
   */
  _convertThrowStatement(content, opportunity) {
    const pattern = /throw\s+new\s+StandardError\s*\(/g
    let count = 0

    const convertedContent = content.replace(pattern, (match) => {
      count++
      return 'throw new StandardError('
    })

    return {
      converted: count > 0,
      content: convertedContent,
      count
    }
  }

  /**
   * 轉換錯誤處理邏輯
   * @param {string} content - 檔案內容
   * @param {Object} opportunity - 轉換機會
   * @returns {Object} 轉換結果
   * @private
   */
  _convertErrorHandling(content, opportunity) {
    // 這是高風險轉換，暫時不自動執行
    return {
      converted: false,
      content,
      count: 0,
      reason: '錯誤處理轉換需要人工確認'
    }
  }

  /**
   * 轉換程式碼存取
   * @param {string} content - 檔案內容
   * @param {Object} opportunity - 轉換機會
   * @returns {Object} 轉換結果
   * @private
   */
  _convertCodeAccess(content, opportunity) {
    // 暫時保持原樣，需要更謹慎的分析
    return {
      converted: false,
      content,
      count: 0,
      reason: '程式碼存取轉換需要語法分析'
    }
  }

  /**
   * 準備手動輔助
   * @private
   */
  async _prepareManualAssistance() {
    console.log('🛠 準備手動轉換輔助...')

    // 產生詳細的手動轉換指南
    await this._generateManualConversionGuide()

    // 產生轉換清單
    await this._generateConversionChecklist()

    console.log('📋 手動轉換輔助資料已準備完成')
  }

  /**
   * 產生手動轉換指南
   * @private
   */
  async _generateManualConversionGuide() {
    const guide = {
      overview: {
        totalFiles: this.conversionResults.statistics.affectedFiles,
        conversionOpportunities: this.conversionResults.statistics.conversionOpportunities,
        riskDistribution: Object.fromEntries(this.conversionResults.statistics.riskDistribution)
      },
      stepByStepGuide: this._createStepByStepGuide(),
      fileByFileAnalysis: this._createFileByFileAnalysis(),
      riskAssessment: this._createRiskAssessment(),
      testingRecommendations: this._createTestingRecommendations()
    }

    const guidePath = path.join(this.config.reportPath, 'manual-conversion-guide.json')
    await fs.mkdir(path.dirname(guidePath), { recursive: true })
    await fs.writeFile(guidePath, JSON.stringify(guide, null, 2))
  }

  /**
   * 建立逐步指南
   * @returns {Array} 逐步指南
   * @private
   */
  _createStepByStepGuide() {
    return [
      {
        step: 1,
        title: '準備階段',
        actions: [
          '確認所有測試通過',
          '建立代碼備份',
          '設定開發環境'
        ]
      },
      {
        step: 2,
        title: '低風險轉換',
        actions: [
          '轉換測試檔案中的 StandardError',
          '更新匯入語句',
          '轉換簡單的建構函式使用'
        ]
      },
      {
        step: 3,
        title: '中等風險轉換',
        actions: [
          '轉換工具函式中的使用',
          '更新錯誤處理邏輯',
          '驗證轉換結果'
        ]
      },
      {
        step: 4,
        title: '高風險轉換',
        actions: [
          '分析核心系統檔案',
          '制定專門的轉換策略',
          '進行漸進式轉換'
        ]
      },
      {
        step: 5,
        title: '驗證階段',
        actions: [
          '執行完整測試套件',
          '進行整合測試',
          '效能驗證'
        ]
      }
    ]
  }

  /**
   * 建立檔案分析
   * @returns {Array} 檔案分析結果
   * @private
   */
  _createFileByFileAnalysis() {
    return this.conversionResults.conversionCandidates.map(candidate => ({
      file: candidate.file,
      totalOpportunities: candidate.opportunities.length,
      riskLevels: candidate.opportunities.reduce((acc, opp) => {
        acc[opp.risk] = (acc[opp.risk] || 0) + 1
        return acc
      }, {}),
      recommendedOrder: candidate.opportunities
        .sort((a, b) => this._calculatePriority(a.risk, a.matchCount) - this._calculatePriority(b.risk, b.matchCount))
        .map(opp => ({
          strategy: opp.strategy,
          risk: opp.risk,
          priority: this._calculatePriority(opp.risk, opp.matchCount)
        }))
    }))
  }

  /**
   * 建立風險評估
   * @returns {Object} 風險評估結果
   * @private
   */
  _createRiskAssessment() {
    return {
      overallRisk: this._calculateOverallRisk(),
      riskFactors: this._identifyOverallRiskFactors(),
      mitigationStrategy: this._createOverallMitigationStrategy(),
      contingencyPlan: this._createContingencyPlan()
    }
  }

  /**
   * 計算整體風險
   * @returns {string} 整體風險等級
   * @private
   */
  _calculateOverallRisk() {
    const riskCounts = this.conversionResults.statistics.riskDistribution
    const total = Array.from(riskCounts.values()).reduce((sum, count) => sum + count, 0)

    if (total === 0) return CONVERSION_RISKS.LOW

    const criticalRatio = (riskCounts.get(CONVERSION_RISKS.CRITICAL) || 0) / total
    const highRatio = (riskCounts.get(CONVERSION_RISKS.HIGH) || 0) / total

    if (criticalRatio > 0.1) return CONVERSION_RISKS.CRITICAL
    if (highRatio > 0.3) return CONVERSION_RISKS.HIGH
    if (criticalRatio > 0 || highRatio > 0.1) return CONVERSION_RISKS.MEDIUM

    return CONVERSION_RISKS.LOW
  }

  /**
   * 識別整體風險因子
   * @returns {Array} 風險因子
   * @private
   */
  _identifyOverallRiskFactors() {
    const factors = []
    const stats = this.conversionResults.statistics

    if (stats.affectedFiles > 50) {
      factors.push('大量檔案受影響 (>50)')
    }

    if (stats.conversionOpportunities > 200) {
      factors.push('大量轉換點 (>200)')
    }

    const coreFiles = this.conversionResults.conversionCandidates.filter(c => c.file.includes('core')).length
    if (coreFiles > 0) {
      factors.push(`${coreFiles} 個核心系統檔案受影響`)
    }

    return factors
  }

  /**
   * 建立整體緩解策略
   * @returns {Array} 緩解策略
   * @private
   */
  _createOverallMitigationStrategy() {
    const overallRisk = this._calculateOverallRisk()
    const strategies = []

    strategies.push('建立完整的測試覆蓋')
    strategies.push('實施分階段轉換')
    strategies.push('設置自動化驗證')

    if (overallRisk === CONVERSION_RISKS.HIGH || overallRisk === CONVERSION_RISKS.CRITICAL) {
      strategies.push('設立專門的轉換團隊')
      strategies.push('建立詳細的回滾計畫')
      strategies.push('進行影響分析')
    }

    return strategies
  }

  /**
   * 建立應急計畫
   * @returns {Object} 應急計畫
   * @private
   */
  _createContingencyPlan() {
    return {
      backupStrategy: '自動備份所有修改檔案',
      rollbackProcedure: '使用 Git 回滾到轉換前狀態',
      emergencyContacts: ['開發團隊負責人', '架構師'],
      escalationTriggers: [
        '測試失敗率 > 5%',
        '效能下降 > 10%',
        '關鍵功能異常'
      ],
      recoverySteps: [
        '停止轉換過程',
        '評估影響範圍',
        '執行回滾操作',
        '分析失敗原因',
        '調整轉換策略'
      ]
    }
  }

  /**
   * 建立測試建議
   * @returns {Array} 測試建議
   * @private
   */
  _createTestingRecommendations() {
    return [
      {
        phase: '轉換前',
        tests: [
          '執行完整測試套件建立基準',
          '驗證所有功能正常運作',
          '記錄效能基準數據'
        ]
      },
      {
        phase: '轉換中',
        tests: [
          '每次轉換後執行相關測試',
          '驗證錯誤處理邏輯',
          '檢查向後相容性'
        ]
      },
      {
        phase: '轉換後',
        tests: [
          '執行完整回歸測試',
          '進行整合測試',
          '效能驗證測試',
          '使用者驗收測試'
        ]
      }
    ]
  }

  /**
   * 產生轉換清單
   * @private
   */
  async _generateConversionChecklist() {
    const checklist = this.conversionResults.conversionCandidates.map(candidate => ({
      file: candidate.file,
      status: 'pending',
      opportunities: candidate.opportunities.map(opp => ({
        type: opp.strategy,
        description: opp.description,
        risk: opp.risk,
        priority: this._calculatePriority(opp.risk, opp.matchCount),
        completed: false,
        notes: ''
      }))
    }))

    const checklistPath = path.join(this.config.reportPath, 'conversion-checklist.json')
    await fs.writeFile(checklistPath, JSON.stringify(checklist, null, 2))
  }

  /**
   * 產生轉換報告
   * @returns {Object} 轉換報告
   * @private
   */
  async _generateConversionReport() {
    console.log('📊 產生轉換報告...')

    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        mode: this.config.mode,
        configuration: this.config
      },
      summary: {
        ...this.conversionResults.statistics,
        riskDistribution: Object.fromEntries(this.conversionResults.statistics.riskDistribution),
        overallRisk: this._calculateOverallRisk()
      },
      analysis: {
        affectedFiles: this.conversionResults.conversionCandidates.length,
        topRiskyFiles: this._getTopRiskyFiles(10),
        conversionStrategies: this._summarizeStrategies(),
        estimatedEffort: this._estimateOverallEffort()
      },
      recommendations: {
        immediate: this._getImmediateRecommendations(),
        shortTerm: this._getShortTermRecommendations(),
        longTerm: this._getLongTermRecommendations()
      },
      next_steps: this._generateNextSteps()
    }

    // 儲存詳細報告
    const reportPath = path.join(this.config.reportPath, `auto-conversion-report-${Date.now()}.json`)
    await fs.mkdir(path.dirname(reportPath), { recursive: true })
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2))

    console.log(`📋 轉換報告已產生: ${reportPath}`)
    return report
  }

  /**
   * 取得風險最高的檔案
   * @param {number} limit - 限制數量
   * @returns {Array} 高風險檔案
   * @private
   */
  _getTopRiskyFiles(limit = 10) {
    return this.conversionResults.conversionCandidates
      .map(candidate => ({
        file: candidate.file,
        riskScore: this._calculateFileRiskScore(candidate),
        opportunities: candidate.opportunities.length
      }))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, limit)
  }

  /**
   * 計算檔案風險分數
   * @param {Object} candidate - 轉換候選
   * @returns {number} 風險分數
   * @private
   */
  _calculateFileRiskScore(candidate) {
    const riskWeights = {
      [CONVERSION_RISKS.LOW]: 1,
      [CONVERSION_RISKS.MEDIUM]: 3,
      [CONVERSION_RISKS.HIGH]: 7,
      [CONVERSION_RISKS.CRITICAL]: 15
    }

    return candidate.opportunities.reduce((score, opp) => {
      return score + (riskWeights[opp.risk] || 1) * opp.matchCount
    }, 0)
  }

  /**
   * 總結轉換策略
   * @returns {Object} 策略總結
   * @private
   */
  _summarizeStrategies() {
    const strategySummary = {}

    for (const candidate of this.conversionResults.conversionCandidates) {
      for (const opportunity of candidate.opportunities) {
        const strategy = opportunity.strategy
        if (!strategySummary[strategy]) {
          strategySummary[strategy] = {
            count: 0,
            files: 0,
            riskDistribution: {}
          }
        }

        strategySummary[strategy].count += opportunity.matchCount
        strategySummary[strategy].files++

        const risk = opportunity.risk
        if (!strategySummary[strategy].riskDistribution) {
          strategySummary[strategy].riskDistribution = {}
        }
        strategySummary[strategy].riskDistribution[risk] =
          (strategySummary[strategy].riskDistribution[risk] || 0) + 1
      }
    }

    return strategySummary
  }

  /**
   * 估算整體工作量
   * @returns {Object} 工作量估算
   * @private
   */
  _estimateOverallEffort() {
    const effortEstimates = {
      low: 1,    // 1 人時
      medium: 4, // 4 人時
      high: 8,   // 8 人時
      veryHigh: 16 // 16 人時
    }

    let totalHours = 0
    let taskBreakdown = { low: 0, medium: 0, high: 0, veryHigh: 0 }

    for (const candidate of this.conversionResults.conversionCandidates) {
      for (const opportunity of candidate.opportunities) {
        const effort = this._estimateConversionEffort(opportunity)
        const effortKey = effort === '很高' ? 'veryHigh' :
                         effort === '高' ? 'high' :
                         effort === '中' ? 'medium' : 'low'

        // 確保 effortKey 有效
        if (effortEstimates[effortKey] !== undefined) {
          taskBreakdown[effortKey]++
          totalHours += effortEstimates[effortKey]
        } else {
          console.warn(`⚠️ 未知的工作量等級: ${effort} -> ${effortKey}`)
          taskBreakdown.medium++
          totalHours += effortEstimates.medium
        }
      }
    }

    return {
      totalHours,
      totalDays: Math.ceil(totalHours / 8),
      taskBreakdown,
      recommendation: totalHours > 40 ? '建議分階段執行' : '可以一次性完成'
    }
  }

  /**
   * 取得立即建議
   * @returns {Array} 立即行動建議
   * @private
   */
  _getImmediateRecommendations() {
    const recommendations = []

    // 基於風險分布的建議
    const riskDistribution = this.conversionResults.statistics.riskDistribution
    const lowRiskCount = riskDistribution.get(CONVERSION_RISKS.LOW) || 0

    if (lowRiskCount > 0) {
      recommendations.push(`立即開始轉換 ${lowRiskCount} 個低風險項目`)
    }

    // 基於測試覆蓋的建議
    const testFiles = this.conversionResults.conversionCandidates.filter(c => c.file.includes('test')).length
    if (testFiles > 0) {
      recommendations.push(`優先轉換 ${testFiles} 個測試檔案`)
    }

    // 基於準備工作的建議
    recommendations.push('確保所有依賴項目已正確安裝')
    recommendations.push('建立完整的代碼備份')

    return recommendations
  }

  /**
   * 取得短期建議
   * @returns {Array} 短期建議
   * @private
   */
  _getShortTermRecommendations() {
    const recommendations = []

    const mediumRiskCount = this.conversionResults.statistics.riskDistribution.get(CONVERSION_RISKS.MEDIUM) || 0
    if (mediumRiskCount > 0) {
      recommendations.push(`制定計畫轉換 ${mediumRiskCount} 個中等風險項目`)
    }

    recommendations.push('建立轉換進度追蹤機制')
    recommendations.push('設置自動化測試驗證')
    recommendations.push('培訓團隊成員了解新的錯誤處理模式')

    return recommendations
  }

  /**
   * 取得長期建議
   * @returns {Array} 長期建議
   * @private
   */
  _getLongTermRecommendations() {
    const recommendations = []

    const highRiskCount = this.conversionResults.statistics.riskDistribution.get(CONVERSION_RISKS.HIGH) || 0
    const criticalRiskCount = this.conversionResults.statistics.riskDistribution.get(CONVERSION_RISKS.CRITICAL) || 0

    if (highRiskCount > 0 || criticalRiskCount > 0) {
      recommendations.push(`謹慎處理 ${highRiskCount + criticalRiskCount} 個高風險項目`)
    }

    recommendations.push('建立 ErrorCodes 最佳實踐指南')
    recommendations.push('定期檢視和優化錯誤處理策略')
    recommendations.push('考慮逐步淘汰 StandardError 舊式用法')

    return recommendations
  }

  /**
   * 產生下一步行動
   * @returns {Array} 下一步行動清單
   * @private
   */
  _generateNextSteps() {
    const nextSteps = []

    switch (this.config.mode) {
      case CONVERSION_MODES.SCAN_ONLY:
        nextSteps.push('檢視掃描結果並決定轉換策略')
        nextSteps.push('選擇適當的轉換模式')
        break

      case CONVERSION_MODES.SUGGEST_ONLY:
        nextSteps.push('檢視轉換建議並排定優先順序')
        nextSteps.push('開始執行低風險轉換')
        break

      case CONVERSION_MODES.AUTO_CONVERT:
        nextSteps.push('驗證自動轉換結果')
        nextSteps.push('處理剩餘的手動轉換項目')
        break

      case CONVERSION_MODES.MANUAL_ASSIST:
        nextSteps.push('使用轉換指南開始手動轉換')
        nextSteps.push('定期更新轉換清單狀態')
        break
    }

    nextSteps.push('執行完整測試確保功能正常')
    nextSteps.push('更新相關文件')

    return nextSteps
  }
}

/**
 * 遷移模式常數 (從 StandardError 引用)
 */
const MIGRATION_MODES = {
  LEGACY_ONLY: 'legacy_only',       // 僅支援原始 StandardError
  WRAPPER_MODE: 'wrapper_mode',     // 包裝器模式 (預設)
  DUAL_MODE: 'dual_mode',           // 雙重系統模式
  ERRORCODES_ONLY: 'errorcodes_only' // 僅支援 ErrorCodes
}

// CommonJS exports
module.exports = {
  AutoMigrationConverter,
  CONVERSION_MODES,
  CONVERSION_RISKS,
  CODE_PATTERNS,
  MIGRATION_MODES
}