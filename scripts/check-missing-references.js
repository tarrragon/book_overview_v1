#!/usr/bin/env node

/**
 * 文件引用路徑檢查工具
 * 
 * 功能：
 * - 檢查 JavaScript 檔案中的 require() 引用是否存在
 * - 檢查 Markdown 檔案中的連結路徑是否存在
 * - 檢查 JSON 檔案中的路徑引用是否存在
 * - 提供詳細的檢查報告
 */

const fs = require('fs')
const path = require('path')

// 配置
const PROJECT_ROOT = process.cwd()
const EXTENSIONS_TO_CHECK = {
  javascript: ['**/*.js'],
  markdown: ['**/*.md'],
  json: ['**/*.json']
}

const IGNORE_PATTERNS = [
  'node_modules/**',
  'build/**',
  'coverage/**',
  '.git/**',
  '**/*.min.js',
  '**/test-results/**'
]

class PathReferenceChecker {
  constructor() {
    this.missingReferences = []
    this.checkedFiles = 0
    this.totalReferences = 0
  }

  /**
   * 查找指定擴展名的文件
   */
  findFiles(extension) {
    const files = []
    
    const searchDirectory = (dir, baseDir = '') => {
      const items = fs.readdirSync(dir)
      
      for (const item of items) {
        const fullPath = path.join(dir, item)
        const relativePath = path.join(baseDir, item)
        
        // 跳過忽略的目錄
        if (this.shouldIgnore(relativePath)) {
          continue
        }
        
        const stat = fs.statSync(fullPath)
        
        if (stat.isDirectory()) {
          searchDirectory(fullPath, relativePath)
        } else if (stat.isFile() && item.endsWith(`.${extension}`)) {
          files.push(relativePath)
        }
      }
    }
    
    searchDirectory(PROJECT_ROOT)
    return files
  }

  /**
   * 判斷是否應該忽略
   */
  shouldIgnore(filePath) {
    const ignorePaths = [
      'node_modules', 'build', 'coverage', '.git', 
      'test-results', '.jest-cache', '.serena'
    ]
    
    return ignorePaths.some(ignore => 
      filePath.startsWith(ignore) || filePath.includes(`/${ignore}/`)
    )
  }

  /**
   * 執行完整檢查
   */
  async checkAll() {
    console.log('🔍 開始檢查所有文件引用路徑...\n')
    
    // 檢查 JavaScript 文件的 require 引用
    await this.checkJavaScriptRequires()
    
    // 檢查 Markdown 文件的連結
    await this.checkMarkdownLinks()
    
    // 檢查 JSON 文件的路徑引用
    await this.checkJsonReferences()
    
    // 生成報告
    this.generateReport()
  }

  /**
   * 檢查 JavaScript require 引用
   */
  async checkJavaScriptRequires() {
    console.log('📄 檢查 JavaScript require 引用...')
    
    const jsFiles = this.findFiles('js')

    for (const file of jsFiles) {
      const filePath = path.join(PROJECT_ROOT, file)
      try {
        const content = fs.readFileSync(filePath, 'utf8')
        this.checkedFiles++
        
        // 匹配 require() 語句
        const requireMatches = content.match(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)
        
        if (requireMatches) {
          for (const match of requireMatches) {
            const requirePath = match.match(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/)[1]
            this.totalReferences++
            
            if (!this.isValidRequirePath(requirePath, filePath)) {
              this.missingReferences.push({
                type: 'require',
                file: file,
                line: this.getLineNumber(content, match),
                reference: requirePath,
                issue: 'File not found'
              })
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ 無法讀取檔案: ${file}`)
      }
    }
  }

  /**
   * 檢查 Markdown 連結
   */
  async checkMarkdownLinks() {
    console.log('📄 檢查 Markdown 文件連結...')
    
    const mdFiles = this.findFiles('md')

    for (const file of mdFiles) {
      const filePath = path.join(PROJECT_ROOT, file)
      try {
        const content = fs.readFileSync(filePath, 'utf8')
        this.checkedFiles++
        
        // 匹配 Markdown 連結 [text](path)
        const linkMatches = content.match(/\[([^\]]*)\]\(([^)]+)\)/g)
        
        if (linkMatches) {
          for (const match of linkMatches) {
            const linkPath = match.match(/\[([^\]]*)\]\(([^)]+)\)/)[2]
            this.totalReferences++
            
            // 跳過外部連結和錨點
            if (this.isLocalPath(linkPath)) {
              if (!this.isValidMarkdownPath(linkPath, filePath)) {
                this.missingReferences.push({
                  type: 'markdown_link',
                  file: file,
                  line: this.getLineNumber(content, match),
                  reference: linkPath,
                  issue: 'File or directory not found'
                })
              }
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ 無法讀取檔案: ${file}`)
      }
    }
  }

  /**
   * 檢查 JSON 路徑引用
   */
  async checkJsonReferences() {
    console.log('📄 檢查 JSON 文件路徑引用...')
    
    const jsonFiles = this.findFiles('json')

    for (const file of jsonFiles) {
      const filePath = path.join(PROJECT_ROOT, file)
      try {
        const content = fs.readFileSync(filePath, 'utf8')
        const jsonData = JSON.parse(content)
        this.checkedFiles++
        
        this.checkJsonObject(jsonData, file, filePath)
      } catch (error) {
        console.warn(`⚠️ 無法解析 JSON 檔案: ${file}`)
      }
    }
  }

  /**
   * 遞迴檢查 JSON 物件中的路徑
   */
  checkJsonObject(obj, file, basePath, keyPath = '') {
    if (typeof obj === 'string' && this.looksLikePath(obj)) {
      this.totalReferences++
      if (!this.isValidJsonPath(obj, basePath)) {
        this.missingReferences.push({
          type: 'json_path',
          file: file,
          reference: obj,
          keyPath: keyPath,
          issue: 'Path not found'
        })
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        const newKeyPath = keyPath ? `${keyPath}.${key}` : key
        this.checkJsonObject(value, file, basePath, newKeyPath)
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const newKeyPath = keyPath ? `${keyPath}[${index}]` : `[${index}]`
        this.checkJsonObject(item, file, basePath, newKeyPath)
      })
    }
  }

  /**
   * 驗證 require 路徑
   */
  isValidRequirePath(requirePath, fromFile) {
    // 跳過 Node.js 內建模組
    if (this.isNodeBuiltinModule(requirePath)) {
      return true
    }
    
    // 跳過 npm 模組
    if (!requirePath.startsWith('.')) {
      return true // 假設 npm 模組都存在
    }

    // 處理 Jest moduleNameMapper：./src/ 映射到專案根 src/
    if (requirePath.startsWith('./src/')) {
      const mappedPath = requirePath.replace('./src/', 'src/')
      return this.checkFileExists(mappedPath)
    }
    
    // 一般相對路徑處理
    const fromDir = path.dirname(fromFile)
    let targetPath = path.resolve(fromDir, requirePath)
    return this.checkFileExists(targetPath)
  }

  /**
   * 檢查檔案是否存在（支援不同副檔名）
   */
  checkFileExists(targetPath) {
    // 如果是絕對路徑，直接檢查
    if (path.isAbsolute(targetPath)) {
      const extensions = ['', '.js', '.json', '/index.js']
      for (const ext of extensions) {
        const fullPath = targetPath + ext
        if (fs.existsSync(fullPath)) {
          return true
        }
      }
      return false
    }
    
    // 相對於專案根目錄的路徑
    const extensions = ['', '.js', '.json', '/index.js']
    for (const ext of extensions) {
      const fullPath = path.join(PROJECT_ROOT, targetPath + ext)
      if (fs.existsSync(fullPath)) {
        return true
      }
    }
    return false
  }

  /**
   * 驗證 Markdown 路徑
   */
  isValidMarkdownPath(linkPath, fromFile) {
    const fromDir = path.dirname(fromFile)
    const targetPath = path.resolve(fromDir, linkPath)
    
    return fs.existsSync(targetPath)
  }

  /**
   * 驗證 JSON 路徑
   */
  isValidJsonPath(jsonPath, fromFile) {
    if (jsonPath.startsWith('http') || jsonPath.startsWith('//')) {
      return true // 跳過網路路徑
    }
    
    const fromDir = path.dirname(fromFile)
    const targetPath = path.resolve(fromDir, jsonPath)
    
    return fs.existsSync(targetPath)
  }

  /**
   * 判斷是否為 Node.js 內建模組
   */
  isNodeBuiltinModule(moduleName) {
    const builtinModules = [
      'fs', 'path', 'os', 'crypto', 'util', 'events', 'stream', 'buffer',
      'child_process', 'cluster', 'dgram', 'dns', 'domain', 'http', 'https',
      'net', 'querystring', 'readline', 'repl', 'tls', 'tty', 'url', 'v8',
      'vm', 'worker_threads', 'zlib'
    ]
    return builtinModules.includes(moduleName)
  }

  /**
   * 判斷是否為本地路徑
   */
  isLocalPath(linkPath) {
    return !linkPath.startsWith('http') && 
           !linkPath.startsWith('mailto:') && 
           !linkPath.startsWith('#')
  }

  /**
   * 判斷字串是否看起來像路徑
   */
  looksLikePath(str) {
    return str.includes('/') || str.includes('\\') || 
           str.startsWith('./') || str.startsWith('../')
  }

  /**
   * 取得行號
   */
  getLineNumber(content, searchText) {
    const lines = content.substring(0, content.indexOf(searchText)).split('\n')
    return lines.length
  }

  /**
   * 生成檢查報告
   */
  generateReport() {
    console.log('\n📊 路徑引用檢查報告')
    console.log('='.repeat(50))
    console.log(`檢查檔案數: ${this.checkedFiles}`)
    console.log(`總引用數: ${this.totalReferences}`)
    console.log(`缺失引用數: ${this.missingReferences.length}`)
    
    if (this.missingReferences.length === 0) {
      console.log('\n✅ 所有路徑引用都存在！')
      return
    }
    
    console.log('\n❌ 發現缺失的路徑引用：')
    console.log('-'.repeat(50))
    
    // 按類型分組
    const byType = this.missingReferences.reduce((acc, ref) => {
      if (!acc[ref.type]) acc[ref.type] = []
      acc[ref.type].push(ref)
      return acc
    }, {})
    
    for (const [type, refs] of Object.entries(byType)) {
      console.log(`\n🔸 ${type.toUpperCase()} 問題 (${refs.length}個):`)
      refs.forEach(ref => {
        console.log(`  📁 ${ref.file}${ref.line ? `:${ref.line}` : ''}`)
        console.log(`     ❌ ${ref.reference}`)
        console.log(`     💭 ${ref.issue}`)
        if (ref.keyPath) {
          console.log(`     🗝️ ${ref.keyPath}`)
        }
        console.log()
      })
    }
    
    // 建議修正
    console.log('💡 修正建議：')
    console.log('1. 檢查路徑是否正確拼寫')
    console.log('2. 確認檔案是否存在')
    console.log('3. 檢查檔案副檔名是否正確')
    console.log('4. 確認相對路徑計算是否正確')
  }
}

// 執行檢查
if (require.main === module) {
  const checker = new PathReferenceChecker()
  checker.checkAll().catch(console.error)
}

module.exports = PathReferenceChecker