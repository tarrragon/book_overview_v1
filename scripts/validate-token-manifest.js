#!/usr/bin/env node
/**
 * Book Overview - Design Token Manifest 雙向校驗腳本
 *
 * 背景：PROP-014 方案 D（design token 值層統一）成立的必要條件是雙向校驗——
 * 單向校驗（只查 manifest 是否符合 V1）只是把 spec 漏記問題搬家成 manifest 漏記，
 * 無法偵測「V1 新增/修改了 token 但 manifest 忘記同步」的情境（linux 審查意見）。
 *
 * 正向校驗：src/core/design-system/token-manifest.json 內記載的每個 V1 token
 *           （domains.*.tokens[].platforms.v1 非 null 者）必須在 V1 原始檔中
 *           存在對應常數，且數值相符。
 * 反向校驗：V1 四個 token 原始檔（colors/shadows/spacing/typography.js）匯出的
 *           每個常數，必須在 token-manifest.json 中有對應記載。
 *
 * 任一方向不符即視為漂移，exit code 1，並輸出含修復指令的錯誤訊息
 * （避免 warning fatigue：訊息只報「不符」不報怎麼修，會讓人漸漸忽略紅燈）。
 *
 * V1 token 檔解析方式：直接 require() 載入取值，不使用 regex 解析原始碼
 * （regex 解析 JS 語法對格式變動極脆弱）。
 *
 * 設計原則（比照 scripts/validate-manifest.js）：
 *   - 純函式驗證邏輯（collectManifestTokens / flattenExports / validateBidirectional）
 *     與 I/O（loadV1TokenPaths / main 的檔案讀取）分離，便於單元測試以 fixture 驗證核心邏輯。
 *   - 失敗時 exit code 1，成功 exit code 0。
 *
 * CLI 用法：
 *   node scripts/validate-token-manifest.js
 */

const fs = require('fs')
const path = require('path')

const ROOT_DIR = path.join(__dirname, '..')
const MANIFEST_PATH = path.join(ROOT_DIR, 'src/core/design-system/token-manifest.json')

/**
 * V1 token 原始檔清單（token-manifest.json sourceFiles.v1 的對應副本，
 * 供腳本 require() 載入；如新增/移除 V1 token 檔需同步更新此清單）
 */
const V1_SOURCE_FILES = [
  'src/core/design-system/colors.js',
  'src/core/design-system/shadows.js',
  'src/core/design-system/spacing.js',
  'src/core/design-system/typography.js'
]

/**
 * 深度比較兩個 token 值是否相等。token 值最深兩層（如 STATUS_COLORS.unread
 * 的 { fg, bg }），故僅需支援 primitive 與淺層物件比較。
 *
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
function deepEqual (a, b) {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null) return false
  if (typeof a !== 'object') return false
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => deepEqual(a[key], b[key]))
}

/**
 * 將一個 V1 token 檔的 module.exports 攤平為 { path: value } 對照表。
 *
 * path 規則：
 *   - 匯出值為 primitive（如 FONT_FAMILY）→ path 為匯出名本身，不含點號。
 *   - 匯出值為物件（如 COLORS）→ 每個鍵展開為 "匯出名.鍵"（如 "COLORS.primary"）。
 *     鍵值本身若為巢狀物件（如 STATUS_COLORS.unread 的 { fg, bg }），視為單一
 *     token 值不再往下展開，對齊 token-manifest.json schema 的 token 顆粒度。
 *
 * @param {object} moduleExports - require() 載入 V1 token 檔後的 module.exports
 * @returns {Map<string, *>} path -> value
 */
function flattenExports (moduleExports) {
  const flattened = new Map()
  for (const [exportName, exportValue] of Object.entries(moduleExports)) {
    const isPlainObject = exportValue !== null && typeof exportValue === 'object' && !Array.isArray(exportValue)
    if (isPlainObject) {
      for (const [key, value] of Object.entries(exportValue)) {
        flattened.set(`${exportName}.${key}`, value)
      }
    } else {
      flattened.set(exportName, exportValue)
    }
  }
  return flattened
}

/**
 * 載入全部 V1 token 檔，攤平為單一對照表 path -> { value, sourceFile }。
 *
 * @param {object} [options]
 * @param {string} [options.rootDir] - 專案根目錄（測試可覆寫指向 fixture 目錄）
 * @param {string[]} [options.sourceFiles] - 相對於 rootDir 的 V1 token 檔清單
 * @returns {Map<string, { value: *, sourceFile: string }>}
 */
function loadV1TokenPaths (options = {}) {
  const rootDir = options.rootDir || ROOT_DIR
  const sourceFiles = options.sourceFiles || V1_SOURCE_FILES
  const tokenMap = new Map()

  for (const relFile of sourceFiles) {
    const absFile = path.join(rootDir, relFile)
    // 每次載入前清 require cache，避免測試 fixture 之間互相污染
    delete require.cache[require.resolve(absFile)]
    const moduleExports = require(absFile)
    const flattened = flattenExports(moduleExports)
    for (const [tokenPath, value] of flattened.entries()) {
      tokenMap.set(tokenPath, { value, sourceFile: relFile })
    }
  }

  return tokenMap
}

/**
 * 遞迴走訪 token-manifest.json 的 domains 節點，窮舉所有 token 條目。
 * 需支援三種巢狀型態：
 *   - 直接 { tokens: [...] }（如 domains.colors）
 *   - 巢狀子群組 { fontSizes: { tokens: [...] }, ... }（如 domains.typography）
 *   - appOnlyDomains 的 per-file 巢狀（{ animations: { tokens: [...] }, ... }）
 *
 * @param {object} domains - token-manifest.json 的 domains 節點
 * @returns {Array<object>} 每個元素為原始 token 條目 + domainPath（供錯誤訊息定位）
 */
function collectManifestTokens (domains) {
  const tokens = []

  function walk (node, domainPath) {
    if (!node || typeof node !== 'object') return

    if (Array.isArray(node.tokens)) {
      for (const token of node.tokens) {
        tokens.push({ ...token, domainPath })
      }
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === 'tokens') continue
      const isPlainObject = value !== null && typeof value === 'object' && !Array.isArray(value)
      if (isPlainObject) {
        walk(value, domainPath ? `${domainPath}.${key}` : key)
      }
    }
  }

  walk(domains, '')
  return tokens
}

function formatForwardMismatch (token, expected, actual) {
  return (
    `[正向不符] domains.${token.domainPath}「${token.key}」（path: ${token.platforms.v1.path}）\n` +
    `  manifest 記載值: ${JSON.stringify(expected)}\n` +
    `  V1 實際值:       ${JSON.stringify(actual)}\n` +
    '  修復指令：確認何者為正確值後，二擇一修正 —\n' +
    `    (a) 更新 src/core/design-system/token-manifest.json 內 ${token.platforms.v1.path} 條目的 value 為 ${JSON.stringify(actual)}\n` +
    `    (b) 更新 ${token.platforms.v1.path} 的 V1 原始檔數值為 ${JSON.stringify(expected)}（若 manifest 才是正確來源）`
  )
}

function formatForwardMissing (token) {
  return (
    `[正向缺失] domains.${token.domainPath}「${token.key}」（path: ${token.platforms.v1.path}）\n` +
    '  manifest 記載此 V1 token，但 V1 原始檔中找不到對應常數（可能已被移除或重新命名）\n' +
    `  修復指令：確認 ${token.platforms.v1.path} 是否已從 V1 token 檔移除，若是請同步從 token-manifest.json 移除或更新此條目的 path`
  )
}

function formatReverseMissing (v1Path, sourceFile) {
  return (
    `[反向缺失] ${v1Path}\n` +
    `  V1 原始檔（${sourceFile}）已匯出此常數，但 token-manifest.json 未記載\n` +
    `  修復指令：於 src/core/design-system/token-manifest.json 對應 domain 新增一筆 token 條目（platforms.v1.path=${v1Path}）`
  )
}

/**
 * 雙向校驗核心邏輯（純函式，不做 I/O，供 CLI 與單元測試共用）。
 *
 * @param {Array<object>} manifestTokens - collectManifestTokens() 的輸出
 * @param {Map<string, { value: *, sourceFile: string }>} v1TokenMap - loadV1TokenPaths() 的輸出
 * @returns {{ errors: string[], forwardChecked: number, reverseChecked: number }}
 */
function validateBidirectional (manifestTokens, v1TokenMap) {
  const errors = []

  // 正向校驗：manifest 所列 V1 token（platforms.v1 非 null）逐一檢查 V1 檔存在且值相符
  let forwardChecked = 0
  for (const token of manifestTokens) {
    const v1Ref = token.platforms && token.platforms.v1
    if (!v1Ref) continue
    forwardChecked += 1

    const actual = v1TokenMap.get(v1Ref.path)
    if (!actual) {
      errors.push(formatForwardMissing(token))
      continue
    }
    if (!deepEqual(actual.value, v1Ref.value)) {
      errors.push(formatForwardMismatch(token, v1Ref.value, actual.value))
    }
  }

  // 反向校驗：V1 token 檔所有匯出常數逐一檢查 manifest 有記載
  const manifestV1Paths = new Set(
    manifestTokens
      .filter((token) => token.platforms && token.platforms.v1)
      .map((token) => token.platforms.v1.path)
  )
  let reverseChecked = 0
  for (const [v1Path, entry] of v1TokenMap.entries()) {
    reverseChecked += 1
    if (!manifestV1Paths.has(v1Path)) {
      errors.push(formatReverseMissing(v1Path, entry.sourceFile))
    }
  }

  return { errors, forwardChecked, reverseChecked }
}

/**
 * CLI 主流程
 */
function main () {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`[FAIL] token-manifest.json 不存在於: ${MANIFEST_PATH}`)
    process.exit(1)
  }

  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
  } catch (err) {
    console.error(`[FAIL] token-manifest.json 解析失敗: ${err.message}`)
    process.exit(1)
  }

  const manifestTokens = collectManifestTokens(manifest.domains)
  const v1TokenMap = loadV1TokenPaths()
  const { errors, forwardChecked, reverseChecked } = validateBidirectional(manifestTokens, v1TokenMap)

  if (errors.length > 0) {
    console.error(
      `[FAIL] token-manifest 雙向校驗失敗（正向查核 ${forwardChecked} 項 / 反向查核 ${reverseChecked} 項，${errors.length} 項不符）：\n`
    )
    console.error(errors.join('\n\n'))
    process.exit(1)
  }

  console.log(
    `[OK] token-manifest 雙向校驗通過（正向查核 ${forwardChecked} 項 V1 token / 反向查核 ${reverseChecked} 項 V1 匯出常數，manifest 與 V1 原始檔一致）`
  )
  process.exit(0)
}

// 僅在直接執行時觸發 CLI；require 時僅匯出純函式
if (require.main === module) {
  main()
}

module.exports = {
  deepEqual,
  flattenExports,
  loadV1TokenPaths,
  collectManifestTokens,
  validateBidirectional,
  V1_SOURCE_FILES
}
