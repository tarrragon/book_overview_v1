#!/usr/bin/env node

/**
 * StandardError 遷移分析執行腳本
 *
 * 執行 Phase 3 遷移分析，生成詳細的遷移計畫
 */

const fs = require('fs')
const path = require('path')

// 模擬 StandardErrorMigrationAnalyzer 功能
class StandardErrorMigrationAnalyzer {
  constructor (options = {}) {
    this.config = {
      projectRoot: options.projectRoot || process.cwd(),
      srcDirectory: options.srcDirectory || 'src',
      excludePatterns: options.excludePatterns || [
        'node_modules', 'build', 'dist', 'coverage', '*.test.js', '*.spec.js'
      ]
    }

    this.analysisResults = {
      totalFiles: 0,
      affectedFiles: [],
      usagePatterns: [],
      migrationPlan: [],
      riskAssessment: {}
    }
  }

  async analyzeForMigration () {
    console.log('🔍 開始 StandardError 遷移分析...\n')

    try {
      await this._scanStandardErrorUsage()
      await this._analyzeUsagePatterns()
      await this._assessMigrationRisks()
      await this._createMigrationPlan()

      const report = this._generateAnalysisReport()
      console.log('✅ StandardError 遷移分析完成')
      return report
    } catch (error) {
      console.error('❌ 遷移分析失敗:', error.message)
      throw error
    }
  }

  async _scanStandardErrorUsage () {
    console.log('📂 掃描 StandardError 使用情況...')

    const srcPath = path.join(this.config.projectRoot, this.config.srcDirectory)
    const files = this._getAllJavaScriptFiles(srcPath)

    this.analysisResults.totalFiles = files.length

    for (const filePath of files) {
      const relativeFilePath = path.relative(this.config.projectRoot, filePath)

      if (!fs.existsSync(filePath)) continue

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

    console.log(`   📊 掃描 ${this.analysisResults.totalFiles} 個檔案`)
    console.log(`   🎯 發現 ${this.analysisResults.affectedFiles.length} 個檔案使用 StandardError`)
  }

  _getAllJavaScriptFiles (directory) {
    const files = []

    if (!fs.existsSync(directory)) return files

    const entries = fs.readdirSync(directory, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name)

      if (entry.isDirectory() && !this._isExcludedPath(entry.name)) {
        const subFiles = this._getAllJavaScriptFiles(fullPath)
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

  _extractStandardErrorUsages (content, filePath) {
    const usages = []
    const lines = content.split('\n')

    lines.forEach((line, index) => {
      if (line.includes('new StandardError(')) {
        // 簡化的錯誤代碼提取
        const codeMatch = line.match(/new StandardError\(\s*['"`]([^'"`]+)['"`]/)
        const errorCode = codeMatch ? codeMatch[1] : 'UNKNOWN'

        usages.push({
          lineNumber: index + 1,
          lineContent: line.trim(),
          errorCode,
          suggestedMigration: this._suggestErrorCodesMigration(errorCode)
        })
      }
    })

    return usages
  }

  _suggestErrorCodesMigration (standardErrorCode) {
    const migrationMap = {
      VALIDATION_ERROR: 'VALIDATION_ERROR',
      REQUIRED_FIELD_MISSING: 'VALIDATION_ERROR',
      OPERATION_FAILED: 'OPERATION_ERROR',
      OPERATION_TIMEOUT: 'TIMEOUT_ERROR',
      CONFIGURATION_ERROR: 'OPERATION_ERROR',
      RESOURCE_NOT_AVAILABLE: 'OPERATION_ERROR',
      NETWORK_ERROR: 'NETWORK_ERROR',
      DOM_ERROR: 'DOM_ERROR',
      STORAGE_ERROR: 'STORAGE_ERROR',
      CHROME_API_ERROR: 'CHROME_ERROR',
      BOOK_ERROR: 'BOOK_ERROR',
      UNKNOWN_ERROR: 'UNKNOWN_ERROR'
    }

    const targetErrorCode = migrationMap[standardErrorCode] || 'UNKNOWN_ERROR'

    return {
      targetErrorCode,
      confidence: migrationMap[standardErrorCode] ? 'HIGH' : 'MEDIUM',
      strategy: this._determineMigrationStrategy(standardErrorCode, targetErrorCode)
    }
  }

  _determineMigrationStrategy (sourceCode, targetCode) {
    if (sourceCode === 'UNKNOWN_ERROR') return 'DIRECT_REPLACEMENT'
    if (targetCode === 'UNKNOWN_ERROR') return 'NEEDS_REVIEW'
    return 'ADAPTER_MIGRATION'
  }

  _categorizeModule (filePath) {
    if (filePath.includes('/core/')) return 'core'
    if (filePath.includes('/ui/')) return 'ui'
    if (filePath.includes('/background/')) return 'background'
    if (filePath.includes('/content/')) return 'content'
    if (filePath.includes('/storage/')) return 'storage'
    if (filePath.includes('/export/')) return 'export'
    if (filePath.includes('/handlers/')) return 'handlers'
    if (filePath.includes('.test.js')) return 'tests'
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

  async _analyzeUsagePatterns () {
    console.log('📈 分析使用模式...')

    const patterns = {
      mostCommonErrors: {},
      moduleDistribution: {},
      complexityDistribution: { low: 0, medium: 0, high: 0 },
      migrationStrategies: {}
    }

    this.analysisResults.affectedFiles.forEach(file => {
      file.usages.forEach(usage => {
        patterns.mostCommonErrors[usage.errorCode] =
          (patterns.mostCommonErrors[usage.errorCode] || 0) + 1

        patterns.migrationStrategies[usage.suggestedMigration.strategy] =
          (patterns.migrationStrategies[usage.suggestedMigration.strategy] || 0) + 1
      })

      patterns.moduleDistribution[file.moduleType] =
        (patterns.moduleDistribution[file.moduleType] || 0) + 1

      patterns.complexityDistribution[file.complexity]++
    })

    this.analysisResults.usagePatterns = patterns

    console.log('   📊 最常見錯誤類型:')
    Object.entries(patterns.mostCommonErrors)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .forEach(([code, count]) => {
        console.log(`      ${code}: ${count} 次`)
      })

    console.log('   📦 模組分布:')
    Object.entries(patterns.moduleDistribution)
      .sort(([, a], [, b]) => b - a)
      .forEach(([module, count]) => {
        console.log(`      ${module}: ${count} 個檔案`)
      })
  }

  async _assessMigrationRisks () {
    console.log('⚠️  評估遷移風險...')

    const riskFactors = {
      fileComplexity: 0,
      moduleInterdependency: 0,
      testCoverage: 0,
      criticalPath: 0
    }

    this.analysisResults.affectedFiles.forEach(file => {
      switch (file.complexity) {
        case 'high': riskFactors.fileComplexity += 3; break
        case 'medium': riskFactors.fileComplexity += 2; break
        case 'low': riskFactors.fileComplexity += 1; break
      }

      if (this._isCriticalModule(file.filePath)) {
        riskFactors.criticalPath += 5
      }
    })

    const totalRisk = Object.values(riskFactors).reduce((sum, risk) => sum + risk, 0)
    const averageRisk = this.analysisResults.affectedFiles.length > 0
      ? totalRisk / this.analysisResults.affectedFiles.length
      : 0

    let overallRiskLevel
    if (averageRisk < 2) overallRiskLevel = 'LOW'
    else if (averageRisk < 4) overallRiskLevel = 'MEDIUM'
    else if (averageRisk < 6) overallRiskLevel = 'HIGH'
    else overallRiskLevel = 'CRITICAL'

    this.analysisResults.riskAssessment = {
      riskFactors,
      totalRisk,
      averageRisk,
      overallRiskLevel,
      recommendations: this._generateRiskRecommendations(overallRiskLevel)
    }

    console.log(`   📊 整體風險等級: ${overallRiskLevel}`)
    console.log(`   🎯 平均風險分數: ${averageRisk.toFixed(2)}`)
  }

  _isCriticalModule (filePath) {
    const criticalPaths = [
      '/core/errors/', '/background/service-worker',
      '/error-handling/', '/core/event'
    ]
    return criticalPaths.some(path => filePath.includes(path))
  }

  _generateRiskRecommendations (riskLevel) {
    const recommendations = {
      LOW: ['可以採用自動化遷移工具', '並行處理多個模組'],
      MEDIUM: ['分階段遷移', '加強測試覆蓋'],
      HIGH: ['建立完整包裝器', '逐一手動遷移'],
      CRITICAL: ['暫緩遷移', '先重構代碼']
    }
    return recommendations[riskLevel] || []
  }

  async _createMigrationPlan () {
    console.log('📋 建立遷移計畫...')

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

    const phases = []
    let currentPhase = []
    let currentPhaseComplexity = 0

    sortedFiles.forEach(file => {
      const fileWeight = this._calculateMigrationWeight(file)

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

    if (currentPhase.length > 0) {
      phases.push({
        phase: phases.length + 1,
        files: [...currentPhase],
        estimatedEffort: this._estimatePhaseEffort(currentPhase),
        riskLevel: this._calculatePhaseRisk(currentPhase)
      })
    }

    this.analysisResults.migrationPlan = phases

    console.log(`   📊 建立 ${phases.length} 個遷移階段`)
    phases.forEach((phase, index) => {
      console.log(`      階段 ${phase.phase}: ${phase.files.length} 檔案 (風險: ${phase.riskLevel}, 工作量: ${phase.estimatedEffort})`)

      // 顯示前幾個檔案作為範例
      const exampleFiles = phase.files.slice(0, 3)
      exampleFiles.forEach(file => {
        console.log(`         - ${file.filePath} (${file.usages.length} 個使用點)`)
      })
      if (phase.files.length > 3) {
        console.log(`         ... 還有 ${phase.files.length - 3} 個檔案`)
      }
    })
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

  _generateAnalysisReport () {
    const totalUsages = this.analysisResults.affectedFiles.reduce(
      (sum, file) => sum + file.usages.length, 0)

    const report = {
      summary: {
        timestamp: new Date().toISOString(),
        totalFiles: this.analysisResults.totalFiles,
        affectedFiles: this.analysisResults.affectedFiles.length,
        totalUsages,
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

  _generateMigrationRecommendations () {
    const recommendations = []

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

    return recommendations
  }

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
}

// 執行分析
async function runMigrationAnalysis () {
  try {
    const analyzer = new StandardErrorMigrationAnalyzer({
      projectRoot: process.cwd(),
      srcDirectory: 'src'
    })

    const report = await analyzer.analyzeForMigration()

    // 生成詳細報告
    console.log('\n📊 遷移分析報告總結:')
    console.log('='.repeat(50))
    console.log(`📁 總檔案數: ${report.summary.totalFiles}`)
    console.log(`🎯 受影響檔案: ${report.summary.affectedFiles}`)
    console.log(`📈 總使用點數: ${report.summary.totalUsages}`)
    console.log(`⚠️  整體風險等級: ${report.summary.overallRiskLevel}`)
    console.log(`📋 遷移階段數: ${report.summary.migrationPhases}`)

    console.log('\n💡 遷移建議:')
    report.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`)
    })

    console.log('\n📝 下一步行動:')
    report.nextSteps.forEach((step, index) => {
      console.log(`   ${step}`)
    })

    // 保存詳細報告到檔案
    const reportPath = 'migration-analysis-report.json'
    require('fs').writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`\n💾 詳細報告已保存至: ${reportPath}`)

    return report
  } catch (error) {
    console.error('💥 分析過程發生錯誤:', error.message)
    process.exit(1)
  }
}

// 執行分析
runMigrationAnalysis().then(() => {
  console.log('\n🎉 StandardError 遷移分析完成!')
}).catch(error => {
  console.error('💥 分析失敗:', error)
  process.exit(1)
})
