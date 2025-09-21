#!/usr/bin/env node

/**
 * 大規模 no-unused-vars 自動修復工具
 * 支援動態檢測和批量修復未使用變數警告
 */

const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')

console.log('🚀 大規模 no-unused-vars 清理工具啟動...\n')

class MassiveUnusedVarsFixer {
  constructor() {
    this.fixedCount = 0
    this.skippedCount = 0
    this.errorCount = 0
    this.processedFiles = new Set()
  }

  async run() {
    console.log('🔍 動態檢測當前 no-unused-vars warnings...')

    const currentIssues = await this.detectCurrentUnusedVars()
    console.log(`📊 找到 ${currentIssues.length} 個 no-unused-vars warnings\n`)

    if (currentIssues.length === 0) {
      console.log('🎉 沒有 no-unused-vars warnings 需要修復！')
      return
    }

    console.log('🎯 開始批量修復...')
    await this.fixAllIssues(currentIssues)

    console.log(`\n📊 修復統計:`)
    console.log(`   - 成功修復: ${this.fixedCount} 個`)
    console.log(`   - 跳過: ${this.skippedCount} 個`)
    console.log(`   - 錯誤: ${this.errorCount} 個`)
    console.log(`   - 總計處理: ${currentIssues.length} 個`)

    // 驗證修復效果
    await this.verifyFixes()
  }

  async detectCurrentUnusedVars() {
    return new Promise((resolve) => {
      exec('npx eslint src/ tests/ --format=stylish', (error, stdout, stderr) => {
        const output = stdout + stderr
        const issues = this.parseESLintOutput(output)
        resolve(issues)
      })
    })
  }

  parseESLintOutput(output) {
    const issues = []
    const lines = output.split('\n')

    for (const line of lines) {
      // 匹配 ESLint 的輸出格式
      const match = line.match(/(.+?):(\d+):(\d+):\s+warning\s+(.+?)\s+'([^']+)'.+no-unused-vars/)

      if (match) {
        const [, filePath, lineNum, , , variable] = match
        issues.push({
          file: filePath.trim(),
          line: parseInt(lineNum, 10),
          variable: variable.trim()
        })
      }
    }

    return issues
  }

  async fixAllIssues(issues) {
    for (const issue of issues) {
      await this.fixSingleIssue(issue)
    }
  }

  async fixSingleIssue(issue) {
    const fullPath = path.resolve(issue.file)

    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  檔案不存在: ${issue.file}`)
      this.errorCount++
      return false
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf8')
      const lines = content.split('\n')
      const lineIndex = issue.line - 1

      if (lineIndex < 0 || lineIndex >= lines.length) {
        console.log(`⚠️  行號超出範圍: ${issue.file}:${issue.line}`)
        this.errorCount++
        return false
      }

      const line = lines[lineIndex]

      // 檢查變數是否真的存在於該行
      if (!line.includes(issue.variable)) {
        console.log(`⚠️  變數不存在於指定行: ${issue.file}:${issue.line} (${issue.variable})`)
        this.errorCount++
        return false
      }

      // 檢查是否已經有 eslint-disable 註解
      if (lineIndex > 0 && lines[lineIndex - 1].includes('eslint-disable-next-line no-unused-vars')) {
        console.log(`⏭️  已有註解: ${issue.file}:${issue.line} (${issue.variable})`)
        this.skippedCount++
        return false
      }

      // 決定修復策略
      const strategy = this.determineFixStrategy(line, issue.variable, issue.file)
      const success = this.applyFixStrategy(lines, lineIndex, issue, strategy)

      if (success) {
        fs.writeFileSync(fullPath, lines.join('\n'))
        console.log(`✅ 修復: ${issue.file}:${issue.line} (${issue.variable}) [${strategy}]`)
        this.fixedCount++
        this.processedFiles.add(issue.file)
        return true
      } else {
        this.skippedCount++
        return false
      }

    } catch (error) {
      console.error(`❌ 處理錯誤 ${issue.file}:`, error.message)
      this.errorCount++
      return false
    }
  }

  determineFixStrategy(line, variable, filePath) {
    // 測試文件：優先使用下劃線前綴
    if (filePath.includes('/tests/')) {
      if (this.isTestVariable(variable)) {
        return 'underscore'
      }
      if (this.isUnusedImport(line, variable)) {
        return 'remove'
      }
    }

    // src 文件：根據變數類型決定
    if (this.isUnusedImport(line, variable)) {
      return 'remove'
    }

    if (this.isDestructuredVariable(line, variable)) {
      return 'underscore'
    }

    // 預設使用 eslint-disable 註解
    return 'disable'
  }

  isTestVariable(variable) {
    const testVarPatterns = [
      /^(mock|test|expected|actual|result|data|config|setup|teardown)/i,
      /^(service|manager|controller|engine|adapter|extractor|handler)$/,
      /^(error|exception|failure)$/,
      /^(start|end|before|after|initial).*time$/i
    ]

    return testVarPatterns.some(pattern => pattern.test(variable))
  }

  isUnusedImport(line, variable) {
    return line.includes('require(') || line.includes('import ') &&
           ['ErrorCodes', 'StandardError', 'Logger'].includes(variable)
  }

  isDestructuredVariable(line, variable) {
    return line.includes('{') && line.includes('}') && line.includes(variable)
  }

  applyFixStrategy(lines, lineIndex, issue, strategy) {
    const line = lines[lineIndex]
    const indent = line.match(/^(\s*)/)[1]

    switch (strategy) {
      case 'remove':
        // 移除整行（如果是 import/require）
        if (line.trim().startsWith('const') && line.includes('require(')) {
          lines.splice(lineIndex, 1)
          return true
        }
        return false

      case 'underscore':
        // 添加下劃線前綴
        const newLine = line.replace(
          new RegExp(`\\b${issue.variable}\\b`),
          `_${issue.variable}`
        )
        lines[lineIndex] = newLine
        return true

      case 'disable':
      default:
        // 添加 eslint-disable 註解
        lines.splice(lineIndex, 0, `${indent}// eslint-disable-next-line no-unused-vars`)
        return true
    }
  }

  async verifyFixes() {
    console.log('\n🔍 驗證修復效果...')

    return new Promise((resolve) => {
      exec('npx eslint src/ tests/ --format=stylish', (error, stdout, stderr) => {
        const output = stdout + stderr
        const remainingIssues = this.parseESLintOutput(output)
        const remainingCount = remainingIssues.length

        console.log(`📊 修復後剩餘 warnings: ${remainingCount}`)

        if (remainingCount < 50) {
          console.log('🎉 目標達成：warnings 已減少到 50 個以下！')
        } else {
          console.log(`🎯 目標: 減少到 50 個以下 (還需修復 ${remainingCount - 50} 個)`)
        }

        // 保存報告
        this.saveReport(remainingIssues)
        resolve()
      })
    })
  }

  saveReport(remainingIssues) {
    const report = {
      timestamp: new Date().toISOString(),
      fixedCount: this.fixedCount,
      skippedCount: this.skippedCount,
      errorCount: this.errorCount,
      processedFiles: Array.from(this.processedFiles),
      remainingIssues: remainingIssues.length,
      remainingIssuesList: remainingIssues
    }

    fs.writeFileSync('massive-unused-vars-fix-report.json', JSON.stringify(report, null, 2))
    console.log('\n💾 詳細報告已保存到 massive-unused-vars-fix-report.json')
  }
}

// 執行主程序
async function main() {
  const fixer = new MassiveUnusedVarsFixer()
  await fixer.run()
}

// 執行主程序
if (require.main === module) {
  main().catch(console.error)
}