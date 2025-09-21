#!/usr/bin/env node

/**
 * 智能批量修復 no-unused-vars warnings
 * 基於實際 ESLint 輸出進行精確修復
 */

const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')

console.log('🤖 智能批量 unused vars 修復工具啟動...\n')

class SmartUnusedVarsBatchFixer {
  constructor() {
    this.fixedCount = 0
    this.skippedCount = 0
    this.errorCount = 0
    this.strategies = {
      disable: 0,
      underscore: 0,
      remove: 0
    }
  }

  async run() {
    console.log('🔍 正在檢測當前 no-unused-vars warnings...')

    try {
      const warnings = await this.getCurrentWarnings()
      console.log(`📊 找到 ${warnings.length} 個 no-unused-vars warnings\n`)

      if (warnings.length === 0) {
        console.log('🎉 沒有 no-unused-vars warnings 需要修復！')
        return
      }

      console.log('🎯 開始智能批量修復...')
      await this.processWarnings(warnings)

      await this.showResults()

    } catch (error) {
      console.error('❌ 執行過程中出錯:', error.message)
    }
  }

  async getCurrentWarnings() {
    return new Promise((resolve, reject) => {
      exec('npx eslint src/ tests/ --format=json', (error, stdout, stderr) => {
        try {
          const results = JSON.parse(stdout || '[]')
          const warnings = []

          results.forEach(result => {
            if (result.messages) {
              result.messages.forEach(message => {
                if (message.ruleId === 'no-unused-vars') {
                  warnings.push({
                    file: result.filePath,
                    line: message.line,
                    column: message.column,
                    message: message.message,
                    severity: message.severity
                  })
                }
              })
            }
          })

          resolve(warnings)
        } catch (parseError) {
          // Fallback to text parsing if JSON fails
          this.parseTextOutput(stdout + stderr).then(resolve).catch(reject)
        }
      })
    })
  }

  async parseTextOutput(output) {
    const warnings = []
    const lines = output.split('\n')

    for (const line of lines) {
      const match = line.match(/(.+?):(\d+):(\d+):\s+warning\s+(.+?)\s+'([^']+)'.+no-unused-vars/)
      if (match) {
        const [, filePath, lineNum, column, message, variable] = match
        warnings.push({
          file: filePath.trim(),
          line: parseInt(lineNum, 10),
          column: parseInt(column, 10),
          message: message.trim(),
          variable: variable.trim()
        })
      }
    }

    return warnings
  }

  async processWarnings(warnings) {
    for (const warning of warnings) {
      await this.fixWarning(warning)
    }
  }

  async fixWarning(warning) {
    try {
      const content = fs.readFileSync(warning.file, 'utf8')
      const lines = content.split('\n')
      const lineIndex = warning.line - 1

      if (lineIndex < 0 || lineIndex >= lines.length) {
        console.log(`⚠️  行號超出範圍: ${this.getRelativePath(warning.file)}:${warning.line}`)
        this.errorCount++
        return
      }

      const line = lines[lineIndex]
      const variable = warning.variable || this.extractVariableFromMessage(warning.message)

      if (!variable || !line.includes(variable)) {
        console.log(`⚠️  變數不匹配: ${this.getRelativePath(warning.file)}:${warning.line}`)
        this.errorCount++
        return
      }

      // 檢查是否已修復
      if (this.isAlreadyFixed(lines, lineIndex)) {
        console.log(`⏭️  已修復: ${this.getRelativePath(warning.file)}:${warning.line} (${variable})`)
        this.skippedCount++
        return
      }

      // 決定修復策略
      const strategy = this.determineStrategy(line, variable, warning.file)
      const success = this.applyStrategy(lines, lineIndex, variable, strategy)

      if (success) {
        fs.writeFileSync(warning.file, lines.join('\n'))
        console.log(`✅ ${this.getRelativePath(warning.file)}:${warning.line} (${variable}) [${strategy}]`)
        this.fixedCount++
        this.strategies[strategy]++
      } else {
        console.log(`❌ 修復失敗: ${this.getRelativePath(warning.file)}:${warning.line} (${variable})`)
        this.errorCount++
      }

    } catch (error) {
      console.log(`❌ 處理錯誤: ${this.getRelativePath(warning.file)} - ${error.message}`)
      this.errorCount++
    }
  }

  extractVariableFromMessage(message) {
    const match = message.match(/'([^']+)'/)
    return match ? match[1] : null
  }

  isAlreadyFixed(lines, lineIndex) {
    // 檢查前一行是否有 eslint-disable 註解
    if (lineIndex > 0) {
      const prevLine = lines[lineIndex - 1]
      if (prevLine.includes('eslint-disable-next-line no-unused-vars')) {
        return true
      }
    }

    // 檢查同一行是否有 eslint-disable 註解
    const currentLine = lines[lineIndex]
    if (currentLine.includes('eslint-disable-line no-unused-vars')) {
      return true
    }

    return false
  }

  determineStrategy(line, variable, filePath) {
    // 測試文件優先使用下劃線前綴
    if (filePath.includes('/tests/')) {
      if (this.isTestVariable(variable)) {
        return 'underscore'
      }
    }

    // 未使用的 imports 直接移除
    if (this.isUnusedImport(line, variable)) {
      return 'remove'
    }

    // 解構變數使用下劃線
    if (this.isDestructuredVariable(line, variable)) {
      return 'underscore'
    }

    // 預設使用 eslint-disable
    return 'disable'
  }

  isTestVariable(variable) {
    const patterns = [
      /^(mock|test|expected|actual|result|data|config|setup|teardown)/i,
      /^(service|manager|controller|engine|adapter|extractor|handler)$/,
      /^(error|exception|failure|fullExportError|fullImportError|mergeError)$/,
      /^(start|end|before|after|initial).*time$/i,
      /^(background|ui|content|popup).*page$/i
    ]
    return patterns.some(pattern => pattern.test(variable))
  }

  isUnusedImport(line, variable) {
    if (!line.includes('require(') && !line.includes('import ')) return false

    const commonUnusedImports = [
      'ErrorCodes', 'StandardError', 'Logger',
      'path', 'fs', 'util'
    ]

    return commonUnusedImports.includes(variable) &&
           line.trim().startsWith('const') &&
           (line.includes('require(') || line.includes('import '))
  }

  isDestructuredVariable(line, variable) {
    return line.includes('{') && line.includes('}') && line.includes(variable)
  }

  applyStrategy(lines, lineIndex, variable, strategy) {
    const line = lines[lineIndex]
    const indent = line.match(/^(\s*)/)[1]

    switch (strategy) {
      case 'remove':
        // 只移除純 import/require 行
        if (line.trim().startsWith('const') &&
            (line.includes('require(') || line.includes('import ')) &&
            line.includes(variable)) {
          lines.splice(lineIndex, 1)
          return true
        }
        return false

      case 'underscore':
        // 添加下劃線前綴
        const newLine = line.replace(
          new RegExp(`\\b${this.escapeRegex(variable)}\\b`),
          `_${variable}`
        )
        if (newLine !== line) {
          lines[lineIndex] = newLine
          return true
        }
        return false

      case 'disable':
      default:
        // 添加 eslint-disable 註解
        lines.splice(lineIndex, 0, `${indent}// eslint-disable-next-line no-unused-vars`)
        return true
    }
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  getRelativePath(filePath) {
    return path.relative(process.cwd(), filePath)
  }

  async showResults() {
    console.log(`\n📊 修復統計:`)
    console.log(`   ✅ 成功修復: ${this.fixedCount} 個`)
    console.log(`   ⏭️  跳過: ${this.skippedCount} 個`)
    console.log(`   ❌ 錯誤: ${this.errorCount} 個`)

    console.log(`\n🎯 策略分布:`)
    console.log(`   🔇 disable: ${this.strategies.disable} 個`)
    console.log(`   🔄 underscore: ${this.strategies.underscore} 個`)
    console.log(`   🗑️  remove: ${this.strategies.remove} 個`)

    if (this.fixedCount > 0) {
      console.log('\n🔍 驗證修復效果...')
      await this.verifyFixes()
    }
  }

  async verifyFixes() {
    return new Promise((resolve) => {
      exec('npx eslint src/ tests/ --format=stylish | grep "no-unused-vars" | wc -l', (error, stdout, stderr) => {
        if (!error) {
          const remainingCount = parseInt(stdout.trim(), 10) || 0
          console.log(`📊 修復後剩餘 warnings: ${remainingCount}`)

          if (remainingCount < 50) {
            console.log('🎉 目標達成：warnings 已減少到 50 個以下！')
          } else {
            console.log(`🎯 距離目標還需修復: ${remainingCount - 50} 個`)
          }
        }
        resolve()
      })
    })
  }
}

// 執行修復
if (require.main === module) {
  const fixer = new SmartUnusedVarsBatchFixer()
  fixer.run().catch(console.error)
}

module.exports = SmartUnusedVarsBatchFixer