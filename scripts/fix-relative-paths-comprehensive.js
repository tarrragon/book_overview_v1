#!/usr/bin/env node

/**
 * 綜合路徑修正腳本
 *
 * 負責功能：
 * - 修正所有 JavaScript 檔案中的深層相對路徑
 * - 轉換為語意化的正確路徑
 * - 維護路徑的語意完整性
 * - 確保模組解析正確性
 */

const fs = require('fs')
const path = require('path')

class PathFixerComprehensive {
  constructor (rootDir) {
    this.rootDir = rootDir
    this.fixedPaths = new Map()
    this.errors = []
    this.stats = {
      filesProcessed: 0,
      pathsFixed: 0,
      errors: 0
    }
  }

  /**
   * 執行全面路徑修正
   */
  async fix () {
    console.log('🔧 開始綜合路徑修正...')

    // 尋找所有 JavaScript 檔案
    const jsFiles = this.findJavaScriptFiles(this.rootDir)
    console.log(`📊 找到 ${jsFiles.length} 個 JavaScript 檔案`)

    for (const filePath of jsFiles) {
      await this.fixFilePathsComprehensive(filePath)
    }

    this.printSummary()
    return this.stats
  }

  /**
   * 尋找所有 JavaScript 檔案
   */
  findJavaScriptFiles (dir) {
    const files = []

    const walkDir = (currentDir) => {
      const items = fs.readdirSync(currentDir)

      for (const item of items) {
        const itemPath = path.join(currentDir, item)
        const stat = fs.statSync(itemPath)

        if (stat.isDirectory() && !this.shouldSkipDirectory(item)) {
          walkDir(itemPath)
        } else if (stat.isFile() && item.endsWith('.js')) {
          files.push(itemPath)
        }
      }
    }

    walkDir(dir)
    return files
  }

  /**
   * 判斷是否跳過目錄
   */
  shouldSkipDirectory (dirName) {
    const skipDirs = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.serena',
      '.claude'
    ]
    return skipDirs.includes(dirName)
  }

  /**
   * 修正單個檔案的路徑
   */
  async fixFilePathsComprehensive (filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      const originalContent = content

      // 修正各種類型的相對路徑
      const fixedContent = this.fixRelativePaths(content, filePath)

      // 如果內容有變更，寫回檔案
      if (fixedContent !== originalContent) {
        fs.writeFileSync(filePath, fixedContent, 'utf8')
        this.stats.filesProcessed++
        console.log(`✅ 修正: ${this.getRelativePath(filePath)}`)
      }
    } catch (error) {
      this.stats.errors++
      this.errors.push({
        file: filePath,
        error: error.message
      })
      console.error(`❌ 修正失敗: ${this.getRelativePath(filePath)} - ${error.message}`)
    }
  }

  /**
   * 修正相對路徑
   */
  fixRelativePaths (content, filePath) {
    let fixedContent = content

    // 匹配 require 語句中的相對路徑
    const requireRegex = /require\s*\(\s*['"`](\.\.[/\\].*?)['"`]\s*\)/g

    fixedContent = fixedContent.replace(requireRegex, (match, relativePath) => {
      const fixedPath = this.calculateCorrectPath(relativePath, filePath)
      if (fixedPath && fixedPath !== relativePath) {
        this.stats.pathsFixed++
        console.log(`  🔄 ${relativePath} → ${fixedPath}`)
        return match.replace(relativePath, fixedPath)
      }
      return match
    })

    return fixedContent
  }

  /**
   * 計算正確的路徑
   */
  calculateCorrectPath (relativePath, sourceFile) {
    try {
      // 獲取當前檔案的目錄
      const sourceDir = path.dirname(sourceFile)

      // 解析相對路徑的絕對位置
      const absoluteTarget = path.resolve(sourceDir, relativePath)

      // 檢查目標檔案是否存在
      const possibleExtensions = ['', '.js']
      let targetExists = false
      let finalTarget = absoluteTarget

      for (const ext of possibleExtensions) {
        const testPath = absoluteTarget + ext
        if (fs.existsSync(testPath)) {
          finalTarget = testPath
          targetExists = true
          break
        }
      }

      if (!targetExists) {
        console.warn(`⚠️  目標檔案不存在: ${relativePath} (從 ${this.getRelativePath(sourceFile)})`)
        return null
      }

      // 計算正確的相對路徑
      const correctRelativePath = path.relative(sourceDir, finalTarget)

      // 標準化路徑分隔符為 Unix 格式
      const normalizedPath = correctRelativePath.replace(/\\/g, '/')

      // 確保相對路徑以 ./ 開頭
      if (!normalizedPath.startsWith('./') && !normalizedPath.startsWith('../')) {
        return './' + normalizedPath
      }

      return normalizedPath
    } catch (error) {
      console.error(`❌ 計算路徑失敗: ${relativePath} - ${error.message}`)
      return null
    }
  }

  /**
   * 獲取相對於專案根目錄的路徑
   */
  getRelativePath (fullPath) {
    return path.relative(this.rootDir, fullPath)
  }

  /**
   * 印出統計摘要
   */
  printSummary () {
    console.log('\n📊 路徑修正統計:')
    console.log(`✅ 檔案處理: ${this.stats.filesProcessed}`)
    console.log(`🔄 路徑修正: ${this.stats.pathsFixed}`)
    console.log(`❌ 錯誤: ${this.stats.errors}`)

    if (this.errors.length > 0) {
      console.log('\n❌ 錯誤詳情:')
      for (const error of this.errors) {
        console.log(`  ${this.getRelativePath(error.file)}: ${error.error}`)
      }
    }
  }
}

// 執行修正
if (require.main === module) {
  const rootDir = path.resolve(__dirname, '..')
  const fixer = new PathFixerComprehensive(rootDir)

  fixer.fix()
    .then(() => {
      console.log('\n🎉 路徑修正完成!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ 修正過程發生錯誤:', error)
      process.exit(1)
    })
}

module.exports = PathFixerComprehensive
