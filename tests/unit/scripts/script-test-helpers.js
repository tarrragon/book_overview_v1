/**
 * scripts/ 測試共用 fsAdapter 工廠（0.19.0-W1-080）
 *
 * Why: build-version-check.test.js 與 validate-manifest.test.js 各自定義同名
 *   createMockFsAdapter 但介面語意完全不同（前者吃 Map{path→content|null}
 *   並支援 readdir/stat；後者吃 string[] 僅支援 fileExists）。同名異介面在
 *   IDE 跳轉與後續第三個 scripts 測試重新實作時形成 naming-confusion
 *   技術債（code-explorer + bay parallel-evaluation 審查 W1-074 發現 TD-1）。
 *
 * Consequence: 不抽取會持續累積——每多一個 scripts 測試就多一個同名 helper，
 *   未來重構某一份時容易誤改其他份的呼叫端，且新進測試作者需重新理解
 *   兩種介面的差異。
 *
 * Action: 提供兩個命名明確的工廠：
 *   - createMinimalFsAdapter(paths[])：僅 fileExists（適合單純路徑存在性測試）
 *   - createFullFsAdapter(fileMap)：fileExists + readFile + readdir + stat
 *     （適合需要遍歷 / 讀取內容的測試，如 worklog 掃描）
 *
 * 跨 ticket 預留：W1-083（SSOT 反轉 IMP）若新增 worklog 同步測試應複用
 *   createFullFsAdapter，無需再定義第三套介面。
 */

/**
 * 建立最小 fsAdapter mock：僅支援 fileExists
 *
 * 適用情境：
 *   - 純路徑存在性驗證（如 validate-manifest 檢查 SW / CS bundle 是否輸出）
 *   - 不需讀取檔案內容或目錄遍歷
 *
 * @param {string[]} existingFiles - 視為存在的檔案路徑陣列
 * @returns {{fileExists: (path: string) => boolean}}
 */
function createMinimalFsAdapter (existingFiles) {
  return {
    fileExists: (filePath) => existingFiles.includes(filePath)
  }
}

/**
 * 建立完整 fsAdapter mock：支援 fileExists / readFile / readdir / stat
 *
 * 適用情境：
 *   - 需要遍歷目錄結構（如掃描 docs/work-logs/v0/ 找 active worklog）
 *   - 需要讀取檔案內容（如解析 v{patch}-main.md 偵測「**狀態**: 開發中」）
 *   - 需要判斷檔案 vs 目錄
 *
 * 約定：fileMap 中 value === null 表示目錄；非 null 表示檔案內容字串。
 *   readdir 列舉所有以 path 為前綴且為直接子項的名稱（不含 path 自身）。
 *
 * @param {Object<string, string|null>} fileMap - 路徑 → 內容字串對應表
 *   （內容為 null 表示為目錄，僅供 stat/readdir 判斷）
 * @returns {{
 *   fileExists: (path: string) => boolean,
 *   readFile: (path: string) => string,
 *   readdir: (path: string) => string[],
 *   stat: (path: string) => {isDirectory: () => boolean}
 * }}
 */
function createFullFsAdapter (fileMap) {
  const normalizePath = (p) => p.replace(/\/+$/, '')
  return {
    fileExists: (p) => Object.prototype.hasOwnProperty.call(fileMap, normalizePath(p)),
    readFile: (p) => {
      const content = fileMap[normalizePath(p)]
      if (typeof content !== 'string') {
        throw new Error(`mock readFile: ${p} 非檔案`)
      }
      return content
    },
    readdir: (p) => {
      const prefix = normalizePath(p) + '/'
      const directChildren = new Set()
      for (const fullPath of Object.keys(fileMap)) {
        if (fullPath.startsWith(prefix)) {
          const remainder = fullPath.slice(prefix.length)
          const firstSegment = remainder.split('/')[0]
          if (firstSegment) directChildren.add(firstSegment)
        }
      }
      return Array.from(directChildren)
    },
    stat: (p) => {
      const content = fileMap[normalizePath(p)]
      return {
        isDirectory: () => content === null
      }
    }
  }
}

module.exports = {
  createMinimalFsAdapter,
  createFullFsAdapter
}
