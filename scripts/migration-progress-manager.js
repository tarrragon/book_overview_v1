#!/usr/bin/env node

/**
 * 遷移進度管理器
 *
 * 整合遷移追蹤器和驗證器，提供完整的遷移進度管理功能。
 * 支援進度追蹤、驗證、報告生成和狀態管理。
 *
 * @version 1.0.0
 * @author Claude Code Assistant
 */

const { MigrationProgressTracker, MIGRATION_STATUS } = require('../src/core/migration/MigrationProgressTracker')
const { MigrationValidator, VALIDATION_RESULT } = require('../src/core/migration/MigrationValidator')
const { StandardErrorMigrationAnalyzer } = require('../src/core/migration/StandardErrorMigrationAnalyzer')
const { AutoMigrationConverter } = require('../src/core/migration/AutoMigrationConverter')

const fs = require('fs').promises
const path = require('path')

/**
 * 遷移進度管理器類別
 */
class MigrationProgressManager {
  constructor (options = {}) {
    this.projectRoot = options.projectRoot || process.cwd()

    // 初始化組件
    this.progressTracker = new MigrationProgressTracker({
      projectRoot: this.projectRoot,
      stateFile: options.stateFile,
      progressFile: options.progressFile,
      backupDir: options.backupDir
    })

    this.validator = new MigrationValidator({
      projectRoot: this.projectRoot,
      syntaxValidation: options.syntaxValidation,
      functionalityValidation: options.functionalityValidation,
      testingValidation: options.testingValidation
    })

    this.analyzer = new StandardErrorMigrationAnalyzer({
      sourceDir: path.join(this.projectRoot, 'src'),
      outputDir: path.join(this.projectRoot, 'docs/migration-reports')
    })

    this.converter = new AutoMigrationConverter({
      sourceDir: path.join(this.projectRoot, 'src'),
      reportPath: path.join(this.projectRoot, 'docs/migration-reports')
    })
  }

  /**
   * 初始化遷移進度管理
   */
  async initialize () {
    console.log('🚀 初始化遷移進度管理器...')

    try {
      await this.progressTracker.initialize()
      console.log('✅ 遷移進度管理器初始化完成')
    } catch (error) {
      console.error('❌ 初始化失敗:', error.message)
      throw error
    }
  }

  /**
   * 開始完整的遷移流程
   */
  async startMigrationFlow (options = {}) {
    console.log('🎯 開始完整遷移流程...')

    const sessionId = await this.progressTracker.startMigrationSession({
      mode: options.mode || 'SUGGEST_ONLY',
      riskThreshold: options.riskThreshold || 'medium',
      targetFiles: options.targetFiles || []
    })

    const flowResult = {
      sessionId,
      startTime: new Date().toISOString(),
      phases: {},
      summary: {}
    }

    try {
      // Phase 1: 分析階段
      console.log('📊 Phase 1: 分析遷移項目...')
      flowResult.phases.analysis = await this._runAnalysisPhase(options)

      // Phase 2: 轉換階段 (如果是自動模式)
      if (options.mode === 'AUTO_CONVERT') {
        console.log('🔄 Phase 2: 執行自動轉換...')
        flowResult.phases.conversion = await this._runConversionPhase(options)
      }

      // Phase 3: 驗證階段
      console.log('🔍 Phase 3: 驗證轉換結果...')
      flowResult.phases.validation = await this._runValidationPhase(options)

      // Phase 4: 報告階段
      console.log('📊 Phase 4: 生成完整報告...')
      flowResult.phases.reporting = await this._runReportingPhase()

      // 計算總結
      flowResult.summary = await this._generateFlowSummary(flowResult)
      flowResult.endTime = new Date().toISOString()

      console.log('✅ 遷移流程完成')
      return flowResult
    } catch (error) {
      console.error('❌ 遷移流程失敗:', error.message)
      flowResult.error = error.message
      flowResult.endTime = new Date().toISOString()
      throw error
    }
  }

  /**
   * 追蹤單一檔案的遷移
   */
  async trackFileMigration (filePath, migrationItems) {
    console.log(`📝 追蹤檔案遷移: ${filePath}`)

    try {
      // 創建備份
      const backupPath = await this.progressTracker.createBackup(filePath)

      // 註冊遷移項目
      const itemIds = []
      for (const item of migrationItems) {
        const itemId = await this.progressTracker.registerMigrationItem(filePath, item)
        itemIds.push(itemId)
      }

      // 執行驗證
      const validationResult = await this.validator.validateFile(filePath, migrationItems)

      // 更新項目狀態
      for (const itemId of itemIds) {
        const status = validationResult.overall === VALIDATION_RESULT.PASS
          ? MIGRATION_STATUS.VERIFIED
          : MIGRATION_STATUS.FAILED

        await this.progressTracker.updateItemStatus(itemId, status, {
          backupPath,
          validationResult
        })
      }

      console.log(`✅ 檔案遷移追蹤完成: ${filePath}`)
      return { itemIds, validationResult, backupPath }
    } catch (error) {
      console.error(`❌ 檔案遷移追蹤失敗: ${filePath}`, error.message)
      throw error
    }
  }

  /**
   * 批量處理遷移項目
   */
  async processBatchMigration (fileList, options = {}) {
    console.log(`📦 開始批量遷移: ${fileList.length} 個檔案`)

    const batchResult = {
      totalFiles: fileList.length,
      processedFiles: 0,
      successfulFiles: 0,
      failedFiles: 0,
      files: [],
      summary: {}
    }

    for (const filePath of fileList) {
      try {
        console.log(`🔄 處理檔案: ${filePath}`)

        // 分析檔案中的遷移項目
        const analysisResult = await this.analyzer.analyzeFile(filePath)

        if (analysisResult.conversionOpportunities.length === 0) {
          console.log(`⏭️ 跳過檔案 (無遷移項目): ${filePath}`)
          continue
        }

        // 如果是自動轉換模式，執行轉換
        let conversionResult = null
        if (options.mode === 'AUTO_CONVERT') {
          conversionResult = await this.converter.convertFile(filePath, {
            riskThreshold: options.riskThreshold || 'medium'
          })
        }

        // 追蹤遷移
        const trackingResult = await this.trackFileMigration(
          filePath,
          analysisResult.conversionOpportunities
        )

        batchResult.files.push({
          filePath,
          analysisResult,
          conversionResult,
          trackingResult,
          status: trackingResult.validationResult.overall
        })

        batchResult.processedFiles++
        if (trackingResult.validationResult.overall === VALIDATION_RESULT.PASS) {
          batchResult.successfulFiles++
        } else {
          batchResult.failedFiles++
        }
      } catch (error) {
        console.error(`❌ 處理檔案失敗: ${filePath}`, error.message)
        batchResult.files.push({
          filePath,
          error: error.message,
          status: VALIDATION_RESULT.FAIL
        })
        batchResult.processedFiles++
        batchResult.failedFiles++
      }
    }

    batchResult.summary = {
      successRate: (batchResult.successfulFiles / batchResult.processedFiles * 100).toFixed(2),
      failureRate: (batchResult.failedFiles / batchResult.processedFiles * 100).toFixed(2)
    }

    console.log(`📊 批量遷移完成: ${batchResult.successfulFiles} 成功, ${batchResult.failedFiles} 失敗`)
    return batchResult
  }

  /**
   * 獲取遷移進度報告
   */
  async getProgressReport () {
    const progress = this.progressTracker.getProgress()
    const detailedReport = await this.progressTracker.generateDetailedReport()

    return {
      basic: progress,
      detailed: detailedReport,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 驗證專案整體狀態
   */
  async validateProjectStatus () {
    console.log('🏗 驗證專案整體狀態...')

    const projectValidation = await this.validator.validateProject()
    const progressReport = await this.getProgressReport()

    const overallStatus = {
      migration: progressReport.basic,
      validation: projectValidation,
      overall: this._determineOverallStatus(progressReport, projectValidation),
      recommendations: this._generateStatusRecommendations(progressReport, projectValidation)
    }

    console.log(`📋 專案狀態: ${overallStatus.overall}`)
    return overallStatus
  }

  /**
   * 回滾遷移
   */
  async rollbackMigration (itemIds) {
    console.log(`🔄 回滾遷移項目: ${itemIds.length} 個項目`)

    const rollbackResults = []

    for (const itemId of itemIds) {
      try {
        // 這裡需要實作回滾邏輯
        // 從備份恢復檔案，更新狀態等
        await this.progressTracker.updateItemStatus(itemId, MIGRATION_STATUS.ROLLBACK)

        rollbackResults.push({
          itemId,
          status: 'success'
        })
      } catch (error) {
        console.error(`❌ 回滾失敗: ${itemId}`, error.message)
        rollbackResults.push({
          itemId,
          status: 'failed',
          error: error.message
        })
      }
    }

    const successCount = rollbackResults.filter(r => r.status === 'success').length
    console.log(`📊 回滾完成: ${successCount} 成功, ${rollbackResults.length - successCount} 失敗`)

    return rollbackResults
  }

  // ==================== 私有方法 ====================

  /**
   * 執行分析階段
   */
  async _runAnalysisPhase (options) {
    const analysisResult = await this.analyzer.analyzeForMigration()

    // 從分析結果中提取受影響的檔案
    const affectedFiles = this.analyzer.analysisResults?.affectedFiles || []

    // 註冊發現的遷移項目
    for (const file of affectedFiles) {
      if (file.usages && file.usages.length > 0) {
        for (const usage of file.usages) {
          await this.progressTracker.registerMigrationItem(file.filePath, {
            type: usage.type || 'throw',
            line: usage.lineNumber || 0,
            column: usage.columnNumber || 0,
            originalCode: usage.originalCode || '',
            targetCode: usage.suggestedCode || '',
            riskLevel: usage.riskLevel || 'medium'
          })
        }
      }
    }

    return analysisResult
  }

  /**
   * 執行轉換階段
   */
  async _runConversionPhase (options) {
    const conversionResult = await this.converter.convertFiles({
      mode: 'AUTO_CONVERT',
      riskThreshold: options.riskThreshold,
      backupBeforeConvert: true
    })

    // 更新轉換項目的狀態
    const updates = []
    for (const file of conversionResult.processedFiles) {
      for (const conversion of file.conversions) {
        updates.push({
          itemId: this._generateItemId(file.filePath, conversion),
          status: conversion.success ? MIGRATION_STATUS.COMPLETED : MIGRATION_STATUS.FAILED,
          details: {
            targetCode: conversion.convertedCode,
            errorDetails: conversion.error
          }
        })
      }
    }

    await this.progressTracker.batchUpdateItemStatus(updates)
    return conversionResult
  }

  /**
   * 執行驗證階段
   */
  async _runValidationPhase (options) {
    const completedFiles = Array.from(this.progressTracker.migrationState.files.keys())
      .filter(filePath => {
        const fileState = this.progressTracker.migrationState.files.get(filePath)
        return fileState.status === MIGRATION_STATUS.COMPLETED
      })

    const validationResult = await this.validator.validateBatch(completedFiles)

    // 根據驗證結果更新項目狀態
    for (const fileResult of validationResult.files) {
      const fileState = this.progressTracker.migrationState.files.get(fileResult.filePath)
      if (fileState) {
        for (const itemId of fileState.items) {
          const newStatus = fileResult.overall === VALIDATION_RESULT.PASS
            ? MIGRATION_STATUS.VERIFIED
            : MIGRATION_STATUS.FAILED

          await this.progressTracker.updateItemStatus(itemId, newStatus, {
            validationResult: fileResult
          })
        }
      }
    }

    return validationResult
  }

  /**
   * 執行報告階段
   */
  async _runReportingPhase () {
    const detailedReport = await this.progressTracker.generateDetailedReport()
    const projectValidation = await this.validator.validateProject()

    const combinedReport = {
      migration: detailedReport,
      validation: projectValidation,
      generatedAt: new Date().toISOString()
    }

    // 保存組合報告
    const reportPath = path.join(this.projectRoot, 'docs/migration-reports/combined-report.json')
    await fs.writeFile(reportPath, JSON.stringify(combinedReport, null, 2), 'utf8')

    console.log(`📄 組合報告已保存: ${reportPath}`)
    return combinedReport
  }

  /**
   * 生成流程總結
   */
  async _generateFlowSummary (flowResult) {
    const progress = this.progressTracker.getProgress()

    return {
      totalDuration: new Date(flowResult.endTime) - new Date(flowResult.startTime),
      itemsProcessed: progress.total,
      itemsCompleted: progress.completed,
      successRate: progress.percentage,
      phasesCompleted: Object.keys(flowResult.phases).length,
      overallStatus: progress.percentage === 100 ? 'COMPLETED' : 'IN_PROGRESS'
    }
  }

  /**
   * 判斷整體狀態
   */
  _determineOverallStatus (progressReport, projectValidation) {
    const migrationComplete = progressReport.basic.percentage === 100
    const validationPassed = projectValidation.overall === VALIDATION_RESULT.PASS

    if (migrationComplete && validationPassed) {
      return 'EXCELLENT'
    } else if (migrationComplete || validationPassed) {
      return 'GOOD'
    } else if (progressReport.basic.percentage > 50) {
      return 'FAIR'
    } else {
      return 'NEEDS_ATTENTION'
    }
  }

  /**
   * 生成狀態建議
   */
  _generateStatusRecommendations (progressReport, projectValidation) {
    const recommendations = []

    if (progressReport.basic.percentage < 100) {
      recommendations.push('繼續完成剩餘的遷移項目')
    }

    if (projectValidation.overall !== VALIDATION_RESULT.PASS) {
      recommendations.push('修復專案驗證中發現的問題')
    }

    if (progressReport.basic.statusDistribution.failed > 0) {
      recommendations.push('檢查並修復失敗的遷移項目')
    }

    return recommendations
  }

  /**
   * 生成項目 ID
   */
  _generateItemId (filePath, item) {
    return `${filePath}:${item.line}:${item.column || 0}:${item.type}`
  }
}

// ==================== CLI 介面 ====================

async function main () {
  const args = process.argv.slice(2)
  const command = args[0]

  const manager = new MigrationProgressManager()

  try {
    await manager.initialize()

    switch (command) {
      case 'start': {
        const options = {
          mode: args.includes('--auto') ? 'AUTO_CONVERT' : 'SUGGEST_ONLY',
          riskThreshold: args.includes('--high-risk') ? 'high' : 'medium'
        }
        const result = await manager.startMigrationFlow(options)
        console.log('🎉 遷移流程結果:', JSON.stringify(result.summary, null, 2))
        break
      }

      case 'status': {
        const status = await manager.validateProjectStatus()
        console.log('📊 專案狀態:', JSON.stringify(status, null, 2))
        break
      }

      case 'report': {
        const report = await manager.getProgressReport()
        console.log('📋 進度報告:', JSON.stringify(report.basic, null, 2))
        break
      }

      case 'validate': {
        const validation = await manager.validator.validateProject()
        console.log('🔍 驗證結果:', JSON.stringify(validation, null, 2))
        break
      }

      default:
        console.log(`
遷移進度管理器使用方法:

  node migration-progress-manager.js <command> [options]

命令:
  start                     開始完整遷移流程
  status                    查看專案狀態
  report                    生成進度報告
  validate                  驗證專案狀態

選項:
  --auto                    自動轉換模式
  --high-risk              包含高風險項目

範例:
  node migration-progress-manager.js start --auto
  node migration-progress-manager.js status
  node migration-progress-manager.js report
        `)
        break
    }
  } catch (error) {
    console.error('❌ 執行失敗:', error.message)
    process.exit(1)
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  main()
}

module.exports = { MigrationProgressManager }
