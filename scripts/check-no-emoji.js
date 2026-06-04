#!/usr/bin/env node
/* eslint-disable no-console -- CLI 工具腳本，console 為偵測報告必要輸出 */
/**
 * emoji 偵測腳本（0.19.1-W1-001 預防機制）
 *
 * 目的：防止新 emoji 引入 src/（UI/產品碼），違反 language-constraints 規則 3。
 * 雙防線接入點：
 * - pre-commit（經 package.json lint-staged glob，傳 staged 檔路徑為 args）
 * - CI（npm run lint:emoji，無參數時掃預設 glob src/**\/*.{js,...}）
 *
 * 與 scripts/remove-emoji.js 的關係：
 * - remove-emoji.js 是一次性移除/替換工具（write 模式），含權威字元清單。
 * - 本檔是持續偵測守衛（read-only），偵測集涵蓋 remove-emoji.js 處理的所有字元 + FE0F。
 *
 * IMP-074 教訓：必須加 require.main === module 守衛，避免 import 觸發 CLI exit。
 * 匯出 containsEmoji / findEmoji 供測試與其他模組 import 而不執行 CLI。
 *
 * 偵測集（與 ticket Context Bundle 一致，務必精確）：
 * - Range U+1F000-1FFFF（pictographs / symbols / 火箭等）
 * - Range U+2600-27BF（雜項符號 + dingbats，含 U+2705 U+274C U+26A0 等）
 * - 9 特定字 U+2139 U+2328 U+23ED U+23F0 U+23F1 U+23F3 U+23F8 U+23F9 U+25B6
 *   （刻意逐字列舉，不可用整段 U+2139-25B6——該整段含箭頭 U+2190-21FF、
 *    數學運算子 U+2200-22FF、技術符號、圈號字母等大量合法非 emoji 字元，整段納入會誤判）
 * - U+FE0F variation selector（孤立殘留也算違規）
 *
 * 用法：
 *   node scripts/check-no-emoji.js <file...>   # 檢查指定檔（lint-staged 傳 staged 路徑）
 *   node scripts/check-no-emoji.js             # 無參數 → 掃預設 glob（CI 全量掃描）
 * 行為：發現 emoji → 印 file:line:col 命中 U+XXXX + exit 1；乾淨 → exit 0
 */

'use strict'

const fs = require('fs')
const path = require('path')

// 9 個特定 codepoint（U+2139-25B6 區段，刻意逐字列舉，非整段範圍）
const SPECIFIC_CODEPOINTS = new Set([
  0x2139, 0x2328, 0x23ED, 0x23F0, 0x23F1, 0x23F3, 0x23F8, 0x23F9, 0x25B6
])

const FE0F = 0xFE0F

// 預設掃描範圍（無參數時用，CI 全量掃描 src/ UI/產品碼）：
// glob 等效於 src/**/*.{js,jsx,ts,mjs,cjs,html,css}，由 resolveDefaultGlob 以遞迴 + 副檔名白名單實現
const DEFAULT_SCAN_EXTENSIONS = ['.js', '.jsx', '.ts', '.mjs', '.cjs', '.html', '.css']

/**
 * 判定單一 codepoint 是否屬偵測集
 * @param {number} cp Unicode codepoint
 * @returns {boolean}
 */
function isEmojiCodepoint (cp) {
  if (cp >= 0x1F000 && cp <= 0x1FFFF) return true
  if (cp >= 0x2600 && cp <= 0x27BF) return true
  if (cp === FE0F) return true
  return SPECIFIC_CODEPOINTS.has(cp)
}

/**
 * 格式化 codepoint 為 U+XXXX 字串
 * @param {number} cp
 * @returns {string}
 */
function formatCodepoint (cp) {
  return 'U+' + cp.toString(16).toUpperCase().padStart(4, '0')
}

/**
 * 找出文字中所有 emoji 命中（逐 codepoint 掃描，正確處理 surrogate pair）
 * @param {string} text
 * @returns {Array<{line:number, col:number, char:string, codepoint:string}>}
 */
function findEmoji (text) {
  const hits = []
  let line = 1
  let col = 0
  // 用 for...of 以 codepoint 為單位迭代，自動處理 surrogate pair
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    if (ch === '\n') {
      line += 1
      col = 0
      continue
    }
    col += 1
    if (isEmojiCodepoint(cp)) {
      hits.push({ line, col, char: ch, codepoint: formatCodepoint(cp) })
    }
  }
  return hits
}

/**
 * 文字是否含任一偵測集字元
 * @param {string} text
 * @returns {boolean}
 */
function containsEmoji (text) {
  for (const ch of text) {
    if (isEmojiCodepoint(ch.codePointAt(0))) return true
  }
  return false
}

/**
 * 解析預設 glob 為實際檔案清單（簡易遞迴，無外部依賴）
 * 僅支援本檔 DEFAULT_GLOB 的 src/ + 副檔名白名單形式
 * @returns {string[]}
 */
function resolveDefaultGlob () {
  const exts = new Set(DEFAULT_SCAN_EXTENSIONS)
  const root = path.resolve(process.cwd(), 'src')
  const files = []
  if (!fs.existsSync(root)) return files

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fp)
      } else if (entry.isFile() && exts.has(path.extname(entry.name))) {
        files.push(fp)
      }
    }
  }
  walk(root)
  return files
}

/**
 * 檢查多個檔案，回傳結構化結果（避免 process.exit 干擾測試）
 * @param {string[]} filePaths
 * @returns {{ok:boolean, violations:Array<{file:string, line:number, col:number, codepoint:string}>}}
 */
function checkFiles (filePaths) {
  const violations = []
  for (const fp of filePaths) {
    let content
    try {
      content = fs.readFileSync(fp, 'utf8')
    } catch (err) {
      // 讀檔失敗（路徑不存在等）：記錄到 stderr 但不視為 emoji 違規
      console.error(`[check-no-emoji] 無法讀取 ${fp}: ${err.message}`)
      continue
    }
    for (const hit of findEmoji(content)) {
      violations.push({ file: fp, line: hit.line, col: hit.col, codepoint: hit.codepoint })
    }
  }
  return { ok: violations.length === 0, violations }
}

/**
 * CLI 進入點
 */
function main () {
  const args = process.argv.slice(2)
  const filePaths = args.length > 0 ? args : resolveDefaultGlob()

  if (filePaths.length === 0) {
    console.log('[check-no-emoji] 無檔案可掃描')
    process.exit(0)
  }

  const { ok, violations } = checkFiles(filePaths)

  if (ok) {
    console.log(`[check-no-emoji] OK：掃描 ${filePaths.length} 檔，無 emoji`)
    process.exit(0)
  }

  console.error(`[check-no-emoji] 發現 ${violations.length} 處 emoji（違反 language-constraints 規則 3）：`)
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}:${v.col} 命中 ${v.codepoint}`)
  }
  console.error('修正方式：移除 emoji 或改用 ASCII 標記（如 [OK] / [FAIL] / [WARN]）')
  process.exit(1)
}

module.exports = {
  containsEmoji,
  findEmoji,
  isEmojiCodepoint,
  checkFiles
}

if (require.main === module) {
  main()
}
