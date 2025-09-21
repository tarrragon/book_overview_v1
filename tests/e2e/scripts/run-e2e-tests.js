#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * 端對端測試執行腳本
 *
 * 負責功能：
 * - 自動建置 Extension 並執行端對端測試
 * - 管理測試環境的設定和清理
 * - 生成測試報告和截圖
 * - 提供測試結果的摘要和分析
 *
 * 設計考量：
 * - 確保測試環境的一致性和隔離性
 * - 提供詳細的測試執行記錄
 * - 支援 CI/CD 整合
 * - 優化測試執行效率
 *
 * 處理流程：
 * 1. 檢查測試環境和依賴項
 * 2. 建置開發版本的 Extension
 * 3. 執行端對端測試套件
 * 4. 收集測試結果和效能數據
 * 5. 生成測試報告
 * 6. 清理測試環境
 *
 * 使用情境：
 * - 本地開發時的完整測試執行
 * - CI/CD 流水線中的自動化測試
 * - 發布前的品質保證驗證
 */

const { execSync, spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

class E2ETestRunner {
  constructor () {
    this.projectRoot = path.resolve(__dirname, '../../../..')
    this.testResultsDir = path.join(this.projectRoot, 'test-results')
    this.screenshotsDir = path.join(this.projectRoot, 'tests/e2e/screenshots')
    this.buildDir = path.join(this.projectRoot, 'build/development')

    this.testConfig = {
      timeout: 120000, // 2 分鐘
      headless: process.env.HEADLESS !== 'false',
      verbose: process.env.VERBOSE === 'true',
      retries: process.env.CI ? 2 : 0
    }
  }

  /**
   * 執行完整的端對端測試流程
   */
  async run () {
    try {
      await this.preCheck()
      await this.buildExtension()
      await this.setupTestEnvironment()
      await this.runTests()
      await this.generateReport()

      process.exit(0)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('\n❌ 端對端測試執行失敗:', error.message)
      await this.cleanup()
      process.exit(1)
    }
  }

  /**
   * 執行前置檢查
   */
  async preCheck () {
    // eslint-disable-next-line no-console
    console.log('🔍 執行前置檢查...')

    // 檢查 Node.js 版本
    const nodeVersion = process.version
    // eslint-disable-next-line no-console
    console.log(`  Node.js 版本: ${nodeVersion}`)

    // 檢查必要文件
    const requiredFiles = [
      'package.json',
      'manifest.json',
      'src/background/service-worker.js',
      'src/popup/popup.html'
    ]

    for (const file of requiredFiles) {
      const filePath = path.join(this.projectRoot, file)
      if (!fs.existsSync(filePath)) {
        throw (() => {
          const error = new Error(`必要文件不存在: ${file}`)
          error.code = ErrorCodes.RESOURCE_NOT_FOUND
          error.details = { category: 'testing', originalCode: 'E2E_REQUIRED_FILE_NOT_FOUND' }
          return error
        })()
      }
    }

    // 檢查依賴項是否安裝
    if (!fs.existsSync(path.join(this.projectRoot, 'node_modules'))) {
      // eslint-disable-next-line no-console
      console.log('  🔧 安裝依賴項...')
      execSync('npm install --legacy-peer-deps', {
        cwd: this.projectRoot,
        stdio: 'inherit'
      })
    }

    // eslint-disable-next-line no-console
    console.log('  ✅ 前置檢查通過')
  }

  /**
   * 建置 Extension
   */
  async buildExtension () {
    // eslint-disable-next-line no-console
    console.log('🏗️ 建置 Chrome Extension...')

    try {
      // 清理舊的建置
      if (fs.existsSync(this.buildDir)) {
        execSync(`rm -rf "${this.buildDir}"`, { cwd: this.projectRoot })
      }

      // 執行開發建置
      execSync('npm run build:dev', {
        cwd: this.projectRoot,
        stdio: this.testConfig.verbose ? 'inherit' : 'pipe'
      })

      // 驗證建置結果
      if (!fs.existsSync(this.buildDir)) {
        throw (() => {
          const error = new Error('Extension 建置失敗')
          error.code = ErrorCodes.OPERATION_FAILED
          error.details = { category: 'testing', originalCode: 'E2E_EXTENSION_BUILD_FAILED' }
          return error
        })()
      }

      // eslint-disable-next-line no-console
      console.log('  ✅ Extension 建置完成')
    } catch (error) {
      throw (() => {
        const buildError = new Error(`Extension 建置失敗: ${error.message}`)
        buildError.code = ErrorCodes.OPERATION_ERROR
        buildError.details = { category: 'testing', originalCode: 'E2E_EXTENSION_BUILD_ERROR' }
        return buildError
      })()
    }
  }

  /**
   * 設定測試環境
   */
  async setupTestEnvironment () {
    // 建立測試結果目錄
    [this.testResultsDir, this.screenshotsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    })

    // 清理舊的測試結果
    const existingResults = fs.readdirSync(this.testResultsDir)
    existingResults.forEach(file => {
      if (file.endsWith('.json') || file.endsWith('.xml')) {
        fs.unlinkSync(path.join(this.testResultsDir, file))
      }
    })

    // 設定環境變數
    process.env.EXTENSION_BUILD_PATH = this.buildDir
    process.env.SCREENSHOTS_PATH = this.screenshotsDir
    process.env.TEST_TIMEOUT = this.testConfig.timeout.toString()
  }

  /**
   * 執行測試套件
   */
  async runTests () {
    const testSuites = [
      {
        name: '完整提取工作流程',
        pattern: 'tests/e2e/workflows/**/*.test.js',
        timeout: 60000
      },
      {
        name: 'UI 互動流程',
        pattern: 'tests/e2e/integration/**/*.test.js',
        timeout: 60000
      },
      {
        name: '效能基準測試',
        pattern: 'tests/e2e/performance/**/*.test.js',
        timeout: 120000
      }
    ]

    const results = {
      total: 0,
      passed: 0,
      failed: 0,
      suites: []
    }

    for (const suite of testSuites) {
      try {
        const suiteResult = await this.runTestSuite(suite)
        results.suites.push(suiteResult)
        results.total += suiteResult.total
        results.passed += suiteResult.passed
        results.failed += suiteResult.failed

        // eslint-disable-next-line no-console
        console.log(`  ✅ ${suite.name}: ${suiteResult.passed}/${suiteResult.total} 通過\n`)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.log(`  ❌ ${suite.name} 執行失敗: ${error.message}\n`)
        results.suites.push({
          name: suite.name,
          status: 'failed',
          error: error.message,
          total: 0,
          passed: 0,
          failed: 1
        })
        results.failed += 1
      }
    }

    // 儲存測試結果
    fs.writeFileSync(
      path.join(this.testResultsDir, 'e2e-results.json'),
      JSON.stringify(results, null, 2)
    )

    if (results.failed > 0) {
      throw (() => {
        const error = new Error(`${results.failed} 個測試套件執行失敗`)
        error.code = ErrorCodes.OPERATION_FAILED
        error.details = { category: 'testing', originalCode: 'E2E_TEST_SUITE_FAILURES' }
        return error
      })()
    }
  }

  /**
   * 執行單一測試套件
   */
  async runTestSuite (suite) {
    return new Promise((resolve, reject) => {
      const jestArgs = [
        '--testPathPattern', suite.pattern,
        '--testTimeout', suite.timeout.toString(),
        '--detectOpenHandles',
        '--forceExit'
      ]

      if (this.testConfig.verbose) {
        jestArgs.push('--verbose')
      }

      if (this.testConfig.headless) {
        process.env.HEADLESS = 'true'
      }

      const jestProcess = spawn('npx', ['jest', ...jestArgs], {
        cwd: this.projectRoot,
        stdio: 'pipe',
        env: process.env
      })

      let stdout = ''
      let stderr = ''

      jestProcess.stdout.on('data', (data) => {
        stdout += data.toString()
        if (this.testConfig.verbose) {
          process.stdout.write(data)
        }
      })

      jestProcess.stderr.on('data', (data) => {
        stderr += data.toString()
        if (this.testConfig.verbose) {
          process.stderr.write(data)
        }
      })

      jestProcess.on('close', (code) => {
        const result = this.parseJestOutput(stdout, stderr)
        result.name = suite.name
        result.exitCode = code

        if (code === 0) {
          resolve(result)
        } else {
          reject((() => {
            const error = new Error(`測試套件執行失敗 (exit code: ${code})`)
            error.code = ErrorCodes.OPERATION_FAILED
            error.details = { category: 'testing', originalCode: 'E2E_TEST_SUITE_EXECUTION_FAILED' }
            return error
          })())
        }
      })

      jestProcess.on('error', (error) => {
        reject((() => {
          const execError = new Error(`無法執行測試套件: ${error.message}`)
          execError.code = ErrorCodes.OPERATION_ERROR
          execError.details = { category: 'testing', originalCode: 'E2E_TEST_SUITE_EXECUTION_ERROR' }
          return execError
        })())
      })
    })
  }

  /**
   * 解析 Jest 輸出
   */
  parseJestOutput (stdout, stderr) {
    const result = {
      total: 0,
      passed: 0,
      failed: 0,
      status: 'unknown'
    }

    // 解析測試結果（簡化版本）
    const passedMatch = stdout.match(/(\d+) passing/)
    const failedMatch = stdout.match(/(\d+) failing/)
    const totalMatch = stdout.match(/(\d+) tests/)

    if (totalMatch) result.total = parseInt(totalMatch[1])
    if (passedMatch) result.passed = parseInt(passedMatch[1])
    if (failedMatch) result.failed = parseInt(failedMatch[1])

    result.status = result.failed === 0 ? 'passed' : 'failed'

    return result
  }

  /**
   * 生成測試報告
   */
  async generateReport () {
    const resultsPath = path.join(this.testResultsDir, 'e2e-results.json')
    if (!fs.existsSync(resultsPath)) {
      return
    }

    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'))

    // 生成 HTML 報告
    const htmlReport = this.generateHtmlReport(results)
    fs.writeFileSync(
      path.join(this.testResultsDir, 'e2e-report.html'),
      htmlReport
    )

    // 生成摘要
    const summary = {
      timestamp: new Date().toISOString(),
      duration: Date.now(), // todo: 記錄實際執行時間
      environment: {
        node: process.version,
        platform: process.platform,
        headless: this.testConfig.headless
      },
      results
    }

    fs.writeFileSync(
      path.join(this.testResultsDir, 'e2e-summary.json'),
      JSON.stringify(summary, null, 2)
    )

    // eslint-disable-next-line no-console
    console.log(`  📁 報告位置: ${this.testResultsDir}`)
  }

  /**
   * 生成 HTML 測試報告
   */
  generateHtmlReport (results) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Chrome Extension E2E 測試報告</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 40px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .summary { display: flex; gap: 20px; margin-bottom: 20px; }
          .metric { background: white; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6; }
          .passed { color: #28a745; }
          .failed { color: #dc3545; }
          .suite { margin-bottom: 15px; padding: 15px; border: 1px solid #dee2e6; border-radius: 8px; }
          .suite.passed { border-color: #28a745; background: #f8fff9; }
          .suite.failed { border-color: #dc3545; background: #fff8f8; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📚 Readmoo Extension E2E 測試報告</h1>
          <p>測試時間: ${new Date().toLocaleString('zh-TW')}</p>
        </div>
        
        <div class="summary">
          <div class="metric">
            <h3>總計</h3>
            <p><strong>${results.total}</strong> 個測試</p>
          </div>
          <div class="metric passed">
            <h3>通過</h3>
            <p><strong>${results.passed}</strong> 個測試</p>
          </div>
          <div class="metric failed">
            <h3>失敗</h3>
            <p><strong>${results.failed}</strong> 個測試</p>
          </div>
        </div>
        
        <h2>測試套件結果</h2>
        ${results.suites.map(suite => `
          <div class="suite ${suite.status}">
            <h3>${suite.name}</h3>
            <p>狀態: <span class="${suite.status}">${suite.status}</span></p>
            <p>通過: ${suite.passed || 0} / 總計: ${suite.total || 0}</p>
            ${suite.error ? `<p>錯誤: ${suite.error}</p>` : ''}
          </div>
        `).join('')}
      </body>
      </html>
    `
  }

  /**
   * 清理測試環境
   */
  async cleanup () {
    // 清理環境變數
    delete process.env.EXTENSION_BUILD_PATH
    delete process.env.SCREENSHOTS_PATH
    delete process.env.TEST_TIMEOUT
    delete process.env.HEADLESS

    // eslint-disable-next-line no-console
    console.log('  ✅ 清理完成')
  }
}

// 執行測試
if (require.main === module) {
  const runner = new E2ETestRunner()
  // eslint-disable-next-line no-console
  runner.run().catch(console.error)
}

module.exports = E2ETestRunner
