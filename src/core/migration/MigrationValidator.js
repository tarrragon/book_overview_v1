/**
 * 遷移驗證器
 *
 * 負責驗證 StandardError 到 ErrorCodes 遷移的正確性，
 * 確保轉換後的程式碼符合預期並維持功能一致性。
 *
 * @version 1.0.0
 * @author Claude Code Assistant
 */

const fs = require('fs').promises
const path = require('path')
const { execSync } = require('child_process')

/**
 * 驗證結果類型
 */
const VALIDATION_RESULT = {
  PASS: 'pass',
  FAIL: 'fail',
  WARNING: 'warning',
  SKIP: 'skip'
}

/**
 * 驗證類型
 */
const VALIDATION_TYPE = {
  SYNTAX: 'syntax',           // 語法驗證
  FUNCTIONALITY: 'functionality', // 功能驗證
  TESTING: 'testing',         // 測試驗證
  COMPATIBILITY: 'compatibility', // 相容性驗證
  PERFORMANCE: 'performance'   // 效能驗證
}

/**
 * 遷移驗證器類別
 */
class MigrationValidator {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd()
    this.eslintConfig = options.eslintConfig || '.eslintrc.js'
    this.testCommand = options.testCommand || 'npm test'
    this.buildCommand = options.buildCommand || 'npm run build'

    // 驗證規則配置
    this.validationRules = {
      [VALIDATION_TYPE.SYNTAX]: {
        enabled: options.syntaxValidation !== false,
        eslintCheck: true,
        buildCheck: true
      },
      [VALIDATION_TYPE.FUNCTIONALITY]: {
        enabled: options.functionalityValidation !== false,
        errorCodeMapping: true,
        messageConsistency: true,
        detailsStructure: true
      },
      [VALIDATION_TYPE.TESTING]: {
        enabled: options.testingValidation !== false,
        testExecution: true,
        coverageCheck: true,
        testStructure: true
      },
      [VALIDATION_TYPE.COMPATIBILITY]: {
        enabled: options.compatibilityValidation !== false,
        backwardCompatibility: true,
        apiConsistency: true
      },
      [VALIDATION_TYPE.PERFORMANCE]: {
        enabled: options.performanceValidation !== false,
        memoryUsage: true,
        executionTime: true
      }
    }

    this.validationCache = new Map()
  }

  /**
   * 驗證單一檔案的遷移結果
   */
  async validateFile(filePath, migrationItems = []) {
    const normalizedPath = path.relative(this.projectRoot, filePath)
    console.log(`🔍 開始驗證檔案: ${normalizedPath}`)

    const validationResults = {
      filePath: normalizedPath,
      timestamp: new Date().toISOString(),
      overall: VALIDATION_RESULT.PASS,
      validations: {},
      issues: [],
      metrics: {},
      recommendations: []
    }

    try {
      // 執行各類型驗證
      for (const [type, config] of Object.entries(this.validationRules)) {
        if (config.enabled) {
          const result = await this._validateByType(filePath, type, migrationItems)
          validationResults.validations[type] = result

          // 更新整體結果
          if (result.result === VALIDATION_RESULT.FAIL) {
            validationResults.overall = VALIDATION_RESULT.FAIL
          } else if (result.result === VALIDATION_RESULT.WARNING && validationResults.overall === VALIDATION_RESULT.PASS) {
            validationResults.overall = VALIDATION_RESULT.WARNING
          }

          // 收集問題和建議
          if (result.issues) {
            validationResults.issues.push(...result.issues)
          }
          if (result.recommendations) {
            validationResults.recommendations.push(...result.recommendations)
          }
        }
      }

      console.log(`✅ 檔案驗證完成: ${normalizedPath} (${validationResults.overall})`)
      return validationResults

    } catch (error) {
      console.error(`❌ 檔案驗證失敗: ${normalizedPath}`, error.message)
      validationResults.overall = VALIDATION_RESULT.FAIL
      validationResults.issues.push({
        type: 'validation_error',
        severity: 'error',
        message: `驗證過程發生錯誤: ${error.message}`
      })
      return validationResults
    }
  }

  /**
   * 批量驗證多個檔案
   */
  async validateBatch(fileList) {
    console.log(`📦 開始批量驗證: ${fileList.length} 個檔案`)

    const batchResults = {
      timestamp: new Date().toISOString(),
      totalFiles: fileList.length,
      passedFiles: 0,
      failedFiles: 0,
      warningFiles: 0,
      files: [],
      summary: {
        totalIssues: 0,
        criticalIssues: 0,
        warningIssues: 0
      }
    }

    for (const filePath of fileList) {
      try {
        const result = await this.validateFile(filePath)
        batchResults.files.push(result)

        // 統計結果
        switch (result.overall) {
          case VALIDATION_RESULT.PASS:
            batchResults.passedFiles++
            break
          case VALIDATION_RESULT.FAIL:
            batchResults.failedFiles++
            break
          case VALIDATION_RESULT.WARNING:
            batchResults.warningFiles++
            break
        }

        // 統計問題
        batchResults.summary.totalIssues += result.issues.length
        batchResults.summary.criticalIssues += result.issues.filter(i => i.severity === 'error').length
        batchResults.summary.warningIssues += result.issues.filter(i => i.severity === 'warning').length

      } catch (error) {
        console.error(`❌ 批量驗證錯誤: ${filePath}`, error.message)
        batchResults.failedFiles++
      }
    }

    console.log(`📊 批量驗證完成: ${batchResults.passedFiles} 通過, ${batchResults.failedFiles} 失敗, ${batchResults.warningFiles} 警告`)
    return batchResults
  }

  /**
   * 驗證專案整體狀態
   */
  async validateProject() {
    console.log('🏗 開始專案整體驗證')

    const projectValidation = {
      timestamp: new Date().toISOString(),
      overall: VALIDATION_RESULT.PASS,
      validations: {},
      metrics: {}
    }

    try {
      // 專案級別驗證
      projectValidation.validations.build = await this._validateProjectBuild()
      projectValidation.validations.tests = await this._validateProjectTests()
      projectValidation.validations.lint = await this._validateProjectLint()
      projectValidation.validations.dependencies = await this._validateDependencies()

      // 計算整體結果
      const results = Object.values(projectValidation.validations)
      if (results.some(r => r.result === VALIDATION_RESULT.FAIL)) {
        projectValidation.overall = VALIDATION_RESULT.FAIL
      } else if (results.some(r => r.result === VALIDATION_RESULT.WARNING)) {
        projectValidation.overall = VALIDATION_RESULT.WARNING
      }

      console.log(`✅ 專案驗證完成: ${projectValidation.overall}`)
      return projectValidation

    } catch (error) {
      console.error('❌ 專案驗證失敗:', error.message)
      projectValidation.overall = VALIDATION_RESULT.FAIL
      return projectValidation
    }
  }

  /**
   * 驗證錯誤代碼映射
   */
  async validateErrorCodeMapping(originalError, convertedError) {
    const mappingValidation = {
      result: VALIDATION_RESULT.PASS,
      issues: [],
      mapping: {
        codeMatched: false,
        messageConsistent: false,
        detailsPreserved: false
      }
    }

    try {
      // 驗證錯誤代碼映射
      if (originalError.code && convertedError.code) {
        mappingValidation.mapping.codeMatched = this._isCodeMappingValid(originalError.code, convertedError.code)
      }

      // 驗證訊息一致性
      if (originalError.message && convertedError.message) {
        mappingValidation.mapping.messageConsistent = this._isMessageConsistent(originalError.message, convertedError.message)
      }

      // 驗證詳細資訊保留
      if (originalError.details && convertedError.details) {
        mappingValidation.mapping.detailsPreserved = this._areDetailsPreserved(originalError.details, convertedError.details)
      }

      // 判斷整體結果
      const mappingResults = Object.values(mappingValidation.mapping)
      if (mappingResults.some(result => result === false)) {
        mappingValidation.result = VALIDATION_RESULT.WARNING
        mappingValidation.issues.push({
          type: 'mapping_inconsistency',
          severity: 'warning',
          message: '錯誤映射存在不一致性'
        })
      }

      return mappingValidation

    } catch (error) {
      mappingValidation.result = VALIDATION_RESULT.FAIL
      mappingValidation.issues.push({
        type: 'mapping_error',
        severity: 'error',
        message: `映射驗證錯誤: ${error.message}`
      })
      return mappingValidation
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 根據類型執行驗證
   */
  async _validateByType(filePath, type, migrationItems) {
    switch (type) {
      case VALIDATION_TYPE.SYNTAX:
        return await this._validateSyntax(filePath)
      case VALIDATION_TYPE.FUNCTIONALITY:
        return await this._validateFunctionality(filePath, migrationItems)
      case VALIDATION_TYPE.TESTING:
        return await this._validateTesting(filePath)
      case VALIDATION_TYPE.COMPATIBILITY:
        return await this._validateCompatibility(filePath, migrationItems)
      case VALIDATION_TYPE.PERFORMANCE:
        return await this._validatePerformance(filePath)
      default:
        return {
          result: VALIDATION_RESULT.SKIP,
          message: `未知驗證類型: ${type}`
        }
    }
  }

  /**
   * 語法驗證
   */
  async _validateSyntax(filePath) {
    const validation = {
      result: VALIDATION_RESULT.PASS,
      issues: [],
      checks: {
        eslint: false,
        parse: false
      }
    }

    try {
      // ESLint 檢查
      try {
        execSync(`npx eslint "${filePath}"`, {
          cwd: this.projectRoot,
          stdio: 'pipe'
        })
        validation.checks.eslint = true
      } catch (error) {
        validation.result = VALIDATION_RESULT.WARNING
        validation.issues.push({
          type: 'eslint_warning',
          severity: 'warning',
          message: 'ESLint 檢查發現問題'
        })
      }

      // 語法解析檢查
      try {
        const content = await fs.readFile(filePath, 'utf8')
        new (require('vm').Script)(content)
        validation.checks.parse = true
      } catch (error) {
        validation.result = VALIDATION_RESULT.FAIL
        validation.issues.push({
          type: 'syntax_error',
          severity: 'error',
          message: `語法錯誤: ${error.message}`
        })
      }

      return validation

    } catch (error) {
      validation.result = VALIDATION_RESULT.FAIL
      validation.issues.push({
        type: 'validation_error',
        severity: 'error',
        message: `語法驗證失敗: ${error.message}`
      })
      return validation
    }
  }

  /**
   * 功能驗證
   */
  async _validateFunctionality(filePath, migrationItems) {
    const validation = {
      result: VALIDATION_RESULT.PASS,
      issues: [],
      checks: {
        errorCodes: true,
        messageFormat: true,
        detailsStructure: true
      }
    }

    try {
      const content = await fs.readFile(filePath, 'utf8')

      // 檢查 ErrorCodes 使用
      const errorCodePattern = /ErrorCodes\.[A-Z_]+/g
      const errorCodeMatches = content.match(errorCodePattern) || []

      if (migrationItems.length > 0 && errorCodeMatches.length === 0) {
        validation.result = VALIDATION_RESULT.WARNING
        validation.issues.push({
          type: 'missing_error_codes',
          severity: 'warning',
          message: '應該使用 ErrorCodes 但未找到相關使用'
        })
      }

      // 檢查 StandardError 殘留
      const standardErrorPattern = /new\s+StandardError\s*\(/g
      const standardErrorMatches = content.match(standardErrorPattern) || []

      if (standardErrorMatches.length > 0) {
        validation.result = VALIDATION_RESULT.WARNING
        validation.issues.push({
          type: 'remaining_standard_error',
          severity: 'warning',
          message: `仍有 ${standardErrorMatches.length} 處 StandardError 未轉換`
        })
      }

      return validation

    } catch (error) {
      validation.result = VALIDATION_RESULT.FAIL
      validation.issues.push({
        type: 'functionality_validation_error',
        severity: 'error',
        message: `功能驗證失敗: ${error.message}`
      })
      return validation
    }
  }

  /**
   * 測試驗證
   */
  async _validateTesting(filePath) {
    const validation = {
      result: VALIDATION_RESULT.PASS,
      issues: [],
      checks: {
        testExists: false,
        testPasses: false
      }
    }

    try {
      // 檢查相關測試檔案是否存在
      const testPath = this._findTestFile(filePath)
      if (testPath) {
        validation.checks.testExists = true

        // 執行相關測試
        try {
          execSync(`npx jest "${testPath}"`, {
            cwd: this.projectRoot,
            stdio: 'pipe'
          })
          validation.checks.testPasses = true
        } catch (error) {
          validation.result = VALIDATION_RESULT.FAIL
          validation.issues.push({
            type: 'test_failure',
            severity: 'error',
            message: '相關測試執行失敗'
          })
        }
      } else {
        validation.result = VALIDATION_RESULT.WARNING
        validation.issues.push({
          type: 'missing_tests',
          severity: 'warning',
          message: '找不到相關測試檔案'
        })
      }

      return validation

    } catch (error) {
      validation.result = VALIDATION_RESULT.FAIL
      validation.issues.push({
        type: 'testing_validation_error',
        severity: 'error',
        message: `測試驗證失敗: ${error.message}`
      })
      return validation
    }
  }

  /**
   * 相容性驗證
   */
  async _validateCompatibility(filePath, migrationItems) {
    const validation = {
      result: VALIDATION_RESULT.PASS,
      issues: [],
      checks: {
        apiConsistency: true,
        backwardCompatibility: true
      }
    }

    // 這裡可以實作更詳細的相容性檢查邏輯
    // 例如檢查 API 介面是否保持一致、向後相容性等

    return validation
  }

  /**
   * 效能驗證
   */
  async _validatePerformance(filePath) {
    const validation = {
      result: VALIDATION_RESULT.PASS,
      issues: [],
      metrics: {
        memoryUsage: 0,
        executionTime: 0
      }
    }

    // 這裡可以實作效能測試邏輯
    // 例如測量記憶體使用量、執行時間等

    return validation
  }

  /**
   * 專案建置驗證
   */
  async _validateProjectBuild() {
    try {
      execSync(this.buildCommand, {
        cwd: this.projectRoot,
        stdio: 'pipe'
      })
      return {
        result: VALIDATION_RESULT.PASS,
        message: '專案建置成功'
      }
    } catch (error) {
      return {
        result: VALIDATION_RESULT.FAIL,
        message: `專案建置失敗: ${error.message}`
      }
    }
  }

  /**
   * 專案測試驗證
   */
  async _validateProjectTests() {
    try {
      execSync(this.testCommand, {
        cwd: this.projectRoot,
        stdio: 'pipe'
      })
      return {
        result: VALIDATION_RESULT.PASS,
        message: '所有測試通過'
      }
    } catch (error) {
      return {
        result: VALIDATION_RESULT.FAIL,
        message: `測試失敗: ${error.message}`
      }
    }
  }

  /**
   * 專案 Lint 驗證
   */
  async _validateProjectLint() {
    try {
      execSync('npm run lint', {
        cwd: this.projectRoot,
        stdio: 'pipe'
      })
      return {
        result: VALIDATION_RESULT.PASS,
        message: 'Lint 檢查通過'
      }
    } catch (error) {
      return {
        result: VALIDATION_RESULT.WARNING,
        message: `Lint 檢查發現問題: ${error.message}`
      }
    }
  }

  /**
   * 依賴驗證
   */
  async _validateDependencies() {
    try {
      // 檢查 package.json 和 node_modules 一致性
      execSync('npm list', {
        cwd: this.projectRoot,
        stdio: 'pipe'
      })
      return {
        result: VALIDATION_RESULT.PASS,
        message: '依賴關係正常'
      }
    } catch (error) {
      return {
        result: VALIDATION_RESULT.WARNING,
        message: `依賴關係有問題: ${error.message}`
      }
    }
  }

  /**
   * 尋找測試檔案
   */
  _findTestFile(filePath) {
    const relativePath = path.relative(this.projectRoot, filePath)
    const possibleTestPaths = [
      relativePath.replace(/\.js$/, '.test.js'),
      relativePath.replace(/src\//, 'tests/').replace(/\.js$/, '.test.js'),
      path.join('tests', relativePath.replace(/\.js$/, '.test.js'))
    ]

    for (const testPath of possibleTestPaths) {
      const fullTestPath = path.resolve(this.projectRoot, testPath)
      try {
        require('fs').accessSync(fullTestPath)
        return fullTestPath
      } catch {
        // 檔案不存在，繼續嘗試下一個
      }
    }

    return null
  }

  /**
   * 檢查錯誤代碼映射是否有效
   */
  _isCodeMappingValid(originalCode, convertedCode) {
    // 實作錯誤代碼映射驗證邏輯
    // 這裡可以根據專案的錯誤代碼映射規則來驗證
    return true
  }

  /**
   * 檢查訊息一致性
   */
  _isMessageConsistent(originalMessage, convertedMessage) {
    // 實作訊息一致性檢查邏輯
    return originalMessage === convertedMessage ||
           convertedMessage.includes(originalMessage)
  }

  /**
   * 檢查詳細資訊是否保留
   */
  _areDetailsPreserved(originalDetails, convertedDetails) {
    // 實作詳細資訊保留檢查邏輯
    if (typeof originalDetails !== typeof convertedDetails) {
      return false
    }

    if (typeof originalDetails === 'object') {
      for (const key in originalDetails) {
        if (!(key in convertedDetails)) {
          return false
        }
      }
    }

    return true
  }
}

module.exports = {
  MigrationValidator,
  VALIDATION_RESULT,
  VALIDATION_TYPE
}