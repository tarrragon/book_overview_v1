#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * 事件系統 v2.0 整合測試執行器
 *
 * 負責功能：
 * - 協調執行所有整合測試套件
 * - 生成完整的整合測試報告
 * - 監控測試執行狀態和效能指標
 * - 提供測試結果摘要和建議
 *
 * 執行策略：
 * - 按階段執行整合測試
 * - 即時監控和報告進度
 * - 收集詳細的效能和穩定性資料
 * - 生成可操作的測試報告
 *
 * 使用方式：
 * node tests/integration/run-event-system-v2-integration.js [options]
 *
 * 選項：
 * --verbose: 詳細輸出模式
 * --performance: 包含效能測試
 * --stability: 包含穩定性測試
 * --report: 生成詳細報告
 */

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const { ErrorCodesWithTest: ErrorCodes } = require('@tests/helpers/test-error-codes')

class EventSystemV2IntegrationTestRunner {
  constructor (options = {}) {
    this.options = {
      verbose: false,
      performance: true,
      stability: true,
      report: true,
      timeout: 600000, // 10 分鐘總超時
      ...options
    }

    this.testSuites = [
      {
        name: 'Event System Core Integration',
        file: 'event-system-v2-core-integration.test.js',
        phase: 1,
        required: true,
        estimatedTime: '3-5 minutes'
      },
      {
        name: 'Readmoo Platform Integration',
        file: 'readmoo-platform-v2-integration.test.js',
        phase: 2,
        required: true,
        estimatedTime: '2-4 minutes'
      },
      {
        name: 'Chrome Extension Environment',
        file: 'chrome-extension-v2-environment.test.js',
        phase: 3,
        required: true,
        estimatedTime: '3-5 minutes'
      },
      {
        name: 'Performance and Stability',
        file: 'event-system-v2-performance-stability.test.js',
        phase: 4,
        required: false,
        estimatedTime: '5-8 minutes',
        condition: () => this.options.performance || this.options.stability
      }
    ]

    this.results = {
      startTime: Date.now(),
      endTime: null,
      phases: [],
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        totalTime: 0
      },
      errors: [],
      performance: {
        memoryUsage: [],
        testTimes: []
      }
    }
  }

  async run () {
    this.log('🧪 事件系統 v2.0 整合測試啟動')
    this.log('═══════════════════════════════════════════════════════════════')

    try {
      // 驗證測試環境
      await this.validateEnvironment()

      // 執行測試階段
      await this.executeTestPhases()

      // 生成報告
      if (this.options.report) {
        await this.generateReport()
      }

      // 顯示摘要
      this.displaySummary()
    } catch (error) {
      this.logError('整合測試執行失敗', error)
      process.exit(1)
    }

    this.results.endTime = Date.now()
    this.results.summary.totalTime = this.results.endTime - this.results.startTime

    // 根據結果設置退出碼
    const exitCode = this.results.summary.failedTests > 0 ? 1 : 0
    process.exit(exitCode)
  }

  async validateEnvironment () {
    this.log('🔍 驗證測試環境...')

    // 檢查必要的依賴
    const requiredModules = [
      '@/core/event-bus',
      '@/core/events/event-naming-upgrade-coordinator',
      '@/core/events/event-priority-manager',
      '@/core/events/event-type-definitions',
      '@/platform/readmoo-platform-migration-validator'
    ]

    for (const module of requiredModules) {
      try {
        require(module)
        this.verbose(`✓ ${module} 可用`)
      } catch (error) {
        throw (() => { const error = new Error('error occurred'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
      }
    }

    // 檢查 Jest 可用性
    try {
      const jestPath = require.resolve('jest')
      this.verbose(`✓ Jest 可用於 ${jestPath}`)
    } catch (error) {
      throw (() => { const error = new Error('error occurred'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
    }

    // 檢查測試檔案存在
    const integrationDir = path.join(__dirname)
    for (const suite of this.testSuites) {
      const testFile = path.join(integrationDir, suite.file)
      if (!fs.existsSync(testFile)) {
        throw (() => { const error = new Error('error occurred'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
      }
      this.verbose(`✓ ${suite.file} 存在`)
    }

    this.log('✅ 測試環境驗證完成')
  }

  async executeTestPhases () {
    this.log('🚀 開始執行整合測試階段...')

    const activeTestSuites = this.testSuites.filter(suite => {
      if (suite.condition) {
        return suite.condition()
      }
      return true
    })

    this.log(`📋 將執行 ${activeTestSuites.length} 個測試套件`)

    for (const suite of activeTestSuites) {
      await this.executeTestSuite(suite)
    }
  }

  async executeTestSuite (suite) {
    this.log(`\n🧪 Phase ${suite.phase}: ${suite.name}`)
    this.log(`📁 檔案: ${suite.file}`)
    this.log(`⏱️ 預估時間: ${suite.estimatedTime}`)
    this.log('─'.repeat(60))

    const phaseResult = {
      name: suite.name,
      phase: suite.phase,
      file: suite.file,
      startTime: Date.now(),
      endTime: null,
      status: 'running',
      tests: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      },
      errors: [],
      performance: {
        memoryBefore: process.memoryUsage(),
        memoryAfter: null,
        executionTime: 0
      }
    }

    try {
      const testResult = await this.runJestTest(suite.file)

      phaseResult.endTime = Date.now()
      phaseResult.performance.executionTime = phaseResult.endTime - phaseResult.startTime
      phaseResult.performance.memoryAfter = process.memoryUsage()

      // 解析測試結果
      if (testResult.success) {
        phaseResult.status = 'passed'
        phaseResult.tests = testResult.testResults
        this.log(`✅ Phase ${suite.phase} 完成 - 所有測試通過`)
      } else {
        phaseResult.status = 'failed'
        phaseResult.tests = testResult.testResults
        phaseResult.errors = testResult.errors
        this.logError(`❌ Phase ${suite.phase} 失敗`, testResult.errors)

        if (suite.required) {
          throw (() => { const error = new Error('error occurred'); error.code = ErrorCodes.TEST_ERROR; error.details = { category: 'testing' }; return error })()
        }
      }
    } catch (error) {
      phaseResult.endTime = Date.now()
      phaseResult.status = 'error'
      phaseResult.errors.push(error.message)
      this.logError(`💥 Phase ${suite.phase} 執行錯誤`, error)

      if (suite.required) {
        throw error
      }
    }

    this.results.phases.push(phaseResult)
    this.updateSummary(phaseResult)

    // 顯示階段摘要
    this.displayPhaseResult(phaseResult)
  }

  async runJestTest (testFile) {
    return new Promise((resolve, reject) => {
      const testPath = path.join(__dirname, testFile)
      const jestArgs = [
        testPath,
        '--verbose',
        '--colors',
        '--detectOpenHandles',
        '--forceExit'
      ]

      if (this.options.verbose) {
        jestArgs.push('--verbose')
      }

      const jest = spawn('npx', ['jest', ...jestArgs], {
        cwd: path.join(__dirname, '../..'),
        stdio: ['inherit', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''

      jest.stdout.on('data', (data) => {
        stdout += data.toString()
        if (this.options.verbose) {
          process.stdout.write(data)
        }
      })

      jest.stderr.on('data', (data) => {
        stderr += data.toString()
        if (this.options.verbose) {
          process.stderr.write(data)
        }
      })

      jest.on('close', (code) => {
        const result = this.parseJestOutput(stdout, stderr, code)
        if (code === 0) {
          resolve(result)
        } else {
          resolve({ ...result, success: false })
        }
      })

      jest.on('error', (error) => {
        reject(error)
      })

      // 設置超時
      setTimeout(() => {
        jest.kill('SIGTERM')
        reject(new Error('測試執行超時'))
      }, this.options.timeout)
    })
  }

  parseJestOutput (stdout, stderr, exitCode) {
    const result = {
      success: exitCode === 0,
      testResults: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      },
      errors: []
    }

    // 解析 Jest 輸出
    const lines = stdout.split('\n')

    for (const line of lines) {
      // 解析測試統計
      if (line.includes('Tests:')) {
        const match = line.match(/(\d+) passed.*?(\d+) total/)
        if (match) {
          result.testResults.passed = parseInt(match[1])
          result.testResults.total = parseInt(match[2])
          result.testResults.failed = result.testResults.total - result.testResults.passed
        }
      }

      // 收集錯誤訊息
      if (line.includes('FAIL') || line.includes('Error:')) {
        result.errors.push(line.trim())
      }
    }

    // 如果有 stderr 輸出，也加入錯誤
    if (stderr.trim()) {
      result.errors.push(stderr.trim())
    }

    return result
  }

  updateSummary (phaseResult) {
    this.results.summary.totalTests += phaseResult.tests.total
    this.results.summary.passedTests += phaseResult.tests.passed
    this.results.summary.failedTests += phaseResult.tests.failed
    this.results.summary.skippedTests += phaseResult.tests.skipped

    this.results.performance.memoryUsage.push({
      phase: phaseResult.phase,
      before: phaseResult.performance.memoryBefore,
      after: phaseResult.performance.memoryAfter
    })

    this.results.performance.testTimes.push({
      phase: phaseResult.phase,
      time: phaseResult.performance.executionTime
    })
  }

  displayPhaseResult (phaseResult) {
    const duration = (phaseResult.performance.executionTime / 1000).toFixed(2)
    const memoryDiff = phaseResult.performance.memoryAfter
      ? (phaseResult.performance.memoryAfter.heapUsed - phaseResult.performance.memoryBefore.heapUsed) / 1024 / 1024
      : 0

    this.log(`📊 Phase ${phaseResult.phase} 結果:`)
    this.log(`   狀態: ${this.getStatusIcon(phaseResult.status)} ${phaseResult.status}`)
    this.log(`   測試: ${phaseResult.tests.passed}/${phaseResult.tests.total} 通過`)
    this.log(`   時間: ${duration}s`)
    this.log(`   記憶體: ${memoryDiff > 0 ? '+' : ''}${memoryDiff.toFixed(2)}MB`)

    if (phaseResult.errors.length > 0) {
      this.log(`   錯誤: ${phaseResult.errors.length} 個`)
    }
  }

  displaySummary () {
    const totalTime = (this.results.summary.totalTime / 1000).toFixed(2)
    const successRate = this.results.summary.totalTests > 0
      ? (this.results.summary.passedTests / this.results.summary.totalTests * 100).toFixed(1)
      : 0

    this.log('\n')
    this.log('🏁 事件系統 v2.0 整合測試完成')
    this.log('═══════════════════════════════════════════════════════════════')
    this.log('📊 總體結果:')
    this.log(`   測試套件: ${this.results.phases.length} 個`)
    this.log(`   總測試數: ${this.results.summary.totalTests}`)
    this.log(`   通過測試: ${this.results.summary.passedTests}`)
    this.log(`   失敗測試: ${this.results.summary.failedTests}`)
    this.log(`   跳過測試: ${this.results.summary.skippedTests}`)
    this.log(`   成功率: ${successRate}%`)
    this.log(`   總時間: ${totalTime}s`)

    // 顯示各階段結果
    this.log('\n📋 階段摘要:')
    for (const phase of this.results.phases) {
      const duration = (phase.performance.executionTime / 1000).toFixed(1)
      this.log(`   Phase ${phase.phase}: ${this.getStatusIcon(phase.status)} ${phase.name} (${duration}s)`)
    }

    // 效能摘要
    if (this.results.performance.testTimes.length > 0) {
      const avgTime = this.results.performance.testTimes.reduce((sum, t) => sum + t.time, 0) / this.results.performance.testTimes.length
      this.log('\n⚡ 效能指標:')
      this.log(`   平均階段時間: ${(avgTime / 1000).toFixed(2)}s`)

      const totalMemoryChange = this.results.performance.memoryUsage.reduce((total, usage) => {
        if (usage.after) {
          return total + (usage.after.heapUsed - usage.before.heapUsed)
        }
        return total
      }, 0)
      this.log(`   總記憶體變化: ${(totalMemoryChange / 1024 / 1024).toFixed(2)}MB`)
    }

    // 最終狀態
    if (this.results.summary.failedTests === 0) {
      this.log('\n✅ 所有整合測試通過！事件系統 v2.0 準備就緒。')
    } else {
      this.log('\n❌ 部分測試失敗，請檢查錯誤並修復後重新測試。')
    }
  }

  async generateReport () {
    this.log('\n📄 生成詳細測試報告...')

    const reportData = {
      ...this.results,
      metadata: {
        version: '2.0.0',
        environment: 'integration-test',
        nodeVersion: process.version,
        platform: process.platform,
        cpuArchitecture: process.arch
      },
      recommendations: this.generateRecommendations()
    }

    const reportPath = path.join(__dirname, '../../docs/testing', `event-system-v2-integration-report-${Date.now()}.json`)

    // 確保目錄存在
    const reportDir = path.dirname(reportPath)
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true })
    }

    try {
      fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2))
      this.log(`✅ 報告已儲存至: ${reportPath}`)
    } catch (error) {
      this.logError('無法儲存測試報告', error)
    }
  }

  generateRecommendations () {
    const recommendations = []

    // 基於測試結果生成建議
    if (this.results.summary.failedTests > 0) {
      recommendations.push({
        type: 'error',
        message: '有測試失敗，建議檢查錯誤日誌並修復問題'
      })
    }

    // 效能建議
    const avgTestTime = this.results.performance.testTimes.reduce((sum, t) => sum + t.time, 0) / this.results.performance.testTimes.length
    if (avgTestTime > 300000) { // 超過 5 分鐘
      recommendations.push({
        type: 'performance',
        message: '測試執行時間偏長，建議優化測試效率'
      })
    }

    // 記憶體使用建議
    const maxMemoryUsage = Math.max(...this.results.performance.memoryUsage.map(usage =>
      usage.after ? usage.after.heapUsed : usage.before.heapUsed
    ))
    if (maxMemoryUsage > 500 * 1024 * 1024) { // 超過 500MB
      recommendations.push({
        type: 'memory',
        message: '記憶體使用量較高，建議檢查是否有記憶體洩漏'
      })
    }

    // 成功建議
    if (this.results.summary.failedTests === 0) {
      recommendations.push({
        type: 'success',
        message: '所有整合測試通過，系統準備投入生產使用'
      })
    }

    return recommendations
  }

  getStatusIcon (status) {
    const icons = {
      passed: '✅',
      failed: '❌',
      error: '💥',
      running: '🔄',
      skipped: '⏭️'
    }
    return icons[status] || '❓'
  }

  log (message) {
    console.log(message)
  }

  verbose (message) {
    if (this.options.verbose) {
      console.log(`[VERBOSE] ${message}`)
    }
  }

  logError (message, error) {
    console.error(`❌ ${message}`)
    if (error) {
      if (this.options.verbose) {
        console.error(error)
      } else {
        console.error(error.message || error)
      }
    }
  }
}

// 命令列參數解析
function parseArgs () {
  const args = process.argv.slice(2)
  const options = {}

  for (const arg of args) {
    if (arg === '--verbose') {
      options.verbose = true
    } else if (arg === '--no-performance') {
      options.performance = false
    } else if (arg === '--no-stability') {
      options.stability = false
    } else if (arg === '--no-report') {
      options.report = false
    } else if (arg.startsWith('--timeout=')) {
      options.timeout = parseInt(arg.split('=')[1]) * 1000
    }
  }

  return options
}

// 主執行邏輯
if (require.main === module) {
  const options = parseArgs()
  const runner = new EventSystemV2IntegrationTestRunner(options)

  // 處理中斷信號
  process.on('SIGINT', () => {
    process.exit(130)
  })

  process.on('SIGTERM', () => {
    process.exit(143)
  })

  runner.run().catch(error => {
    console.error('整合測試執行器發生未預期錯誤:', error)
    process.exit(1)
  })
}

module.exports = EventSystemV2IntegrationTestRunner
