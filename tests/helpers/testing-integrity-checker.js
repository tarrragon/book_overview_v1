/**
 * 測試完整性檢查工具
 *
 * 負責功能：
 * - 檢查測試代碼中的假數據使用情況
 * - 驗證記憶體測試是否遵循真實測量原則
 * - 識別並報告不符合最佳實踐的測試模式
 * - 提供測試品質評分和改善建議
 *
 * 設計原則：
 * - 自動化檢測違反最佳實踐的測試模式
 * - 提供具體的修復建議和示例
 * - 支援持續集成中的品質監控
 * - 確保測試系統的完整性和可信度
 */

const fs = require('fs')
const path = require('path')
const { ErrorCodes } = require('../../src/core/errors/ErrorCodes')

class TestingIntegrityChecker {
  constructor (options = {}) {
    this.options = {
      testDirectory: options.testDirectory || 'tests',
      excludePatterns: options.excludePatterns || [
        'node_modules',
        'build',
        'dist'
      ],
      // 違規模式定義
      antiPatterns: {
        // 記憶體測試假數據模式
        fakeMemoryData: [
          /memoryEfficiency\s*:\s*0\.\d+/g,
          /garbageCollectionTriggers\s*:\s*Math\.floor/g,
          /memoryUsage\s*:\s*\d+/g
        ],
        // 硬編碼效能指標
        hardcodedPerformance: [
          /cpuEfficiency\s*:\s*0\.\d+/g,
          /throughput\s*:\s*\d+/g,
          /latency\s*:\s*\d+/g
        ],
        // 假的測試數據
        mockTestData: [
          /success\s*:\s*true.*\/\/.*假/g,
          /expect.*toBe.*\/\/.*模擬/g
        ]
      },
      ...options
    }

    this.results = {
      totalFiles: 0,
      checkedFiles: 0,
      violations: [],
      summary: {},
      recommendations: []
    }
  }

  /**
   * 執行完整性檢查
   */
  async runIntegrityCheck () {
    // eslint-disable-next-line no-console
    console.log('[TestingIntegrityChecker] 開始執行測試完整性檢查...')

    try {
      // 1. 掃描測試文件
      const testFiles = await this._scanTestFiles()

      // 2. 分析每個文件
      for (const filePath of testFiles) {
        await this._analyzeTestFile(filePath)
      }

      // 3. 生成報告
      this._generateReport()

      // 4. 提供建議
      this._generateRecommendations()

      // eslint-disable-next-line no-console
      console.log(`[TestingIntegrityChecker] 檢查完成: ${this.results.checkedFiles} 文件已檢查`)

      return this.results
    } catch (error) {
      throw (() => {
        const err = new Error(`測試完整性檢查失敗: ${error.message}`); err.code = ErrorCodes.TESTING_INTEGRITY_ERROR; err.details = {
          category: 'testing',
          originalError: error
        }; return err
      })()
    }
  }

  /**
   * 掃描測試文件
   * @private
   */
  async _scanTestFiles () {
    const testFiles = []

    const scanDirectory = (dir) => {
      const files = fs.readdirSync(dir, { withFileTypes: true })

      for (const file of files) {
        const fullPath = path.join(dir, file.name)

        // 跳過排除的目錄
        if (this.options.excludePatterns.some(pattern =>
          fullPath.includes(pattern)
        )) {
          continue
        }

        if (file.isDirectory()) {
          scanDirectory(fullPath)
        } else if (file.name.endsWith('.test.js') || file.name.endsWith('.spec.js')) {
          testFiles.push(fullPath)
        }
      }
    }

    scanDirectory(this.options.testDirectory)
    this.results.totalFiles = testFiles.length

    return testFiles
  }

  /**
   * 分析測試文件
   * @private
   */
  async _analyzeTestFile (filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      this.results.checkedFiles++

      // 檢查各種反模式
      this._checkAntiPatterns(filePath, content)

      // 檢查記憶體測試最佳實踐
      this._checkMemoryTestingBestPractices(filePath, content)

      // 檢查測試資料真實性
      this._checkTestDataRealism(filePath, content)
    } catch (error) {
      this.results.violations.push({
        type: 'FILE_READ_ERROR',
        severity: 'medium',
        file: filePath,
        message: `無法讀取測試文件: ${error.message}`,
        line: 0
      })
    }
  }

  /**
   * 檢查反模式
   * @private
   */
  _checkAntiPatterns (filePath, content) {
    const lines = content.split('\n')

    // 檢查每一類反模式
    Object.entries(this.options.antiPatterns).forEach(([category, patterns]) => {
      patterns.forEach(pattern => {
        lines.forEach((line, index) => {
          const matches = line.match(pattern)
          if (matches) {
            this.results.violations.push({
              type: 'ANTI_PATTERN',
              category,
              severity: this._getSeverity(category),
              file: filePath,
              line: index + 1,
              content: line.trim(),
              pattern: pattern.source,
              message: this._getAntiPatternMessage(category),
              suggestion: this._getAntiPatternSuggestion(category)
            })
          }
        })
      })
    })
  }

  /**
   * 檢查記憶體測試最佳實踐
   * @private
   */
  _checkMemoryTestingBestPractices (filePath, content) {
    const lines = content.split('\n')

    // 檢查是否使用 MemoryLeakDetector
    const hasMemoryTest = content.includes('memory') || content.includes('記憶體')
    const usesMemoryLeakDetector = content.includes('MemoryLeakDetector')
    const usesProcessMemoryUsage = content.includes('process.memoryUsage')

    if (hasMemoryTest && !usesMemoryLeakDetector && !usesProcessMemoryUsage) {
      this.results.violations.push({
        type: 'MEMORY_TESTING_VIOLATION',
        severity: 'high',
        file: filePath,
        line: 0,
        message: '記憶體測試應使用 MemoryLeakDetector 或 process.memoryUsage() 進行真實測量',
        suggestion: '引入 MemoryLeakDetector 類別並使用真實的記憶體測量'
      })
    }

    // 檢查垃圾回收相關測試
    lines.forEach((line, index) => {
      if (line.includes('garbageCollection') || line.includes('垃圾回收')) {
        this.results.violations.push({
          type: 'GARBAGE_COLLECTION_TEST',
          severity: 'critical',
          file: filePath,
          line: index + 1,
          content: line.trim(),
          message: '不應測試垃圾回收機制，這是無法控制的系統行為',
          suggestion: '改為測試記憶體洩漏預防和資源釋放'
        })
      }
    })
  }

  /**
   * 檢查測試資料真實性
   * @private
   */
  _checkTestDataRealism (filePath, content) {
    const lines = content.split('\n')

    // 檢查硬編碼的成功率
    const hardcodedSuccessRates = [
      /expect.*success.*toBe.*true.*\/\/.*模擬/g,
      /\.success\s*=\s*true.*\/\/.*假/g
    ]

    hardcodedSuccessRates.forEach(pattern => {
      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          this.results.violations.push({
            type: 'HARDCODED_SUCCESS',
            severity: 'medium',
            file: filePath,
            line: index + 1,
            content: line.trim(),
            message: '避免硬編碼成功狀態，應基於真實操作結果',
            suggestion: '執行實際操作並檢查其結果狀態'
          })
        }
      })
    })
  }

  /**
   * 獲取反模式嚴重程度
   * @private
   */
  _getSeverity (category) {
    const severityMap = {
      fakeMemoryData: 'critical',
      hardcodedPerformance: 'high',
      mockTestData: 'medium'
    }
    return severityMap[category] || 'low'
  }

  /**
   * 獲取反模式錯誤訊息
   * @private
   */
  _getAntiPatternMessage (category) {
    const messageMap = {
      fakeMemoryData: '檢測到記憶體測試假數據，違反真實測量原則',
      hardcodedPerformance: '檢測到硬編碼效能指標，應使用實際測量',
      mockTestData: '檢測到模擬測試資料，降低測試可信度'
    }
    return messageMap[category] || '檢測到測試品質問題'
  }

  /**
   * 獲取反模式修復建議
   * @private
   */
  _getAntiPatternSuggestion (category) {
    const suggestionMap = {
      fakeMemoryData: '使用 MemoryLeakDetector 或 process.memoryUsage() 進行真實記憶體測量',
      hardcodedPerformance: '實際執行操作並測量其效能指標',
      mockTestData: '使用真實資料或基於實際條件的動態資料生成'
    }
    return suggestionMap[category] || '請遵循測試最佳實踐'
  }

  /**
   * 生成報告
   * @private
   */
  _generateReport () {
    // 按類型統計違規
    const violationsByType = {}
    const violationsBySeverity = { critical: 0, high: 0, medium: 0, low: 0 }

    this.results.violations.forEach(violation => {
      violationsByType[violation.type] = (violationsByType[violation.type] || 0) + 1
      violationsBySeverity[violation.severity]++
    })

    this.results.summary = {
      totalViolations: this.results.violations.length,
      violationsByType,
      violationsBySeverity,
      integrityScore: this._calculateIntegrityScore(),
      complianceRate: this._calculateComplianceRate()
    }
  }

  /**
   * 計算完整性評分
   * @private
   */
  _calculateIntegrityScore () {
    const totalFiles = this.results.checkedFiles

    if (totalFiles === 0) return 1.0

    // 基於違規嚴重程度加權計算
    const severityWeights = { critical: 4, high: 3, medium: 2, low: 1 }
    const weightedViolations = this.results.violations.reduce((sum, violation) => {
      return sum + (severityWeights[violation.severity] || 1)
    }, 0)

    // 計算評分 (0-1)
    const maxPossibleScore = totalFiles * 4 // 假設每個文件最多4個critical violations
    const score = Math.max(0, 1 - (weightedViolations / maxPossibleScore))

    return Math.round(score * 100) / 100
  }

  /**
   * 計算合規率
   * @private
   */
  _calculateComplianceRate () {
    const filesWithViolations = new Set(
      this.results.violations.map(v => v.file)
    ).size

    const compliantFiles = this.results.checkedFiles - filesWithViolations
    const rate = this.results.checkedFiles > 0
      ? compliantFiles / this.results.checkedFiles
      : 1.0

    return Math.round(rate * 100) / 100
  }

  /**
   * 生成改善建議
   * @private
   */
  _generateRecommendations () {
    const recommendations = []

    // 基於違規類型提供建議
    const typeCount = this.results.summary.violationsByType

    if (typeCount.ANTI_PATTERN > 0) {
      recommendations.push({
        priority: 'high',
        category: 'code_quality',
        title: '移除反模式代碼',
        description: `發現 ${typeCount.ANTI_PATTERN} 處反模式，建議重構為符合最佳實踐的代碼`,
        action: '檢查並修復所有標記的反模式違規'
      })
    }

    if (typeCount.MEMORY_TESTING_VIOLATION > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'testing_framework',
        title: '改善記憶體測試方法',
        description: '記憶體測試應使用真實測量而非假數據',
        action: '引入 MemoryLeakDetector 工具並重構相關測試'
      })
    }

    if (typeCount.GARBAGE_COLLECTION_TEST > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'testing_strategy',
        title: '停止測試垃圾回收',
        description: '垃圾回收是無法控制的系統行為，不應作為測試目標',
        action: '將測試重點轉向記憶體洩漏預防和資源管理'
      })
    }

    // 整體品質建議
    if (this.results.summary.integrityScore < 0.8) {
      recommendations.push({
        priority: 'high',
        category: 'overall_quality',
        title: '提升測試系統品質',
        description: `目前完整性評分 ${this.results.summary.integrityScore}，建議進行全面重構`,
        action: '遵循測試最佳實踐指南，系統性改善測試品質'
      })
    }

    this.results.recommendations = recommendations
  }

  /**
   * 生成詳細報告
   */
  generateDetailedReport () {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.results.summary,
      files: {
        total: this.results.totalFiles,
        checked: this.results.checkedFiles,
        compliant: this.results.checkedFiles - new Set(this.results.violations.map(v => v.file)).size
      },
      violations: this.results.violations,
      recommendations: this.results.recommendations,
      integrityScore: this.results.summary.integrityScore,
      complianceRate: this.results.summary.complianceRate
    }

    return report
  }

  /**
   * 輸出報告到文件
   */
  async saveReportToFile (outputPath) {
    const report = this.generateDetailedReport()
    const reportContent = JSON.stringify(report, null, 2)

    fs.writeFileSync(outputPath, reportContent, 'utf8')
    // eslint-disable-next-line no-console
    console.log(`[TestingIntegrityChecker] 報告已儲存至: ${outputPath}`)

    return outputPath
  }

  /**
   * 檢查是否通過完整性檢查
   */
  passesIntegrityCheck () {
    const criticalViolations = this.results.violations.filter(
      v => v.severity === 'critical'
    ).length

    return criticalViolations === 0 && this.results.summary.integrityScore >= 0.8
  }
}

module.exports = TestingIntegrityChecker
