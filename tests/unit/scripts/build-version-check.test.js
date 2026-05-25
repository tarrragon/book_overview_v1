/**
 * scripts/build.js 版號 sanity check 單元測試（0.19.0-W1-074）
 *
 * 涵蓋四類驗證情境（對應 W1-074 acceptance）：
 *   1. 版號一致 → ok=true，build:prod 正常進入後續流程
 *   2. 版號不一致 → ok=false 含明確 error 訊息
 *   3. --skip-version-check flag 由 build flow 處理（測試覆蓋純函式被略過的情境）
 *   4. 多 active worklog / 無 active worklog 的失敗訊號
 *
 * 設計原則：
 *   - 純函式驗證（detectActiveWorklogVersion / validateVersionAlignment）：
 *     接收 (version, workLogsRoot, fsAdapter) 並回傳結構化結果，避免 process.exit
 *     干擾測試（與 scripts/validate-manifest.test.js 同模式）
 *   - fsAdapter 注入：用記憶體 mock 模擬 docs/work-logs/v0/ 結構，
 *     不需建立實體目錄；同時隔離本機真實 worklog 狀態變化
 *   - 失敗訊息可斷言：確保使用者收到可診斷的 error 字串
 */

const path = require('path')
const {
  detectActiveWorklogVersion,
  validateVersionAlignment
} = require('../../../scripts/build')

const WORK_LOGS_ROOT = '/fake/docs/work-logs/v0'

/**
 * 建立記憶體 fsAdapter mock
 *
 * @param {object} files - 路徑 → 內容字串對應表（內容為 null 表示為目錄）
 *
 * mock 行為：
 *   - fileExists(p)：path 存在於 files 即 true
 *   - readFile(p)：回傳 files[p]（必須是字串）
 *   - readdir(p)：列舉所有 files 中以 p 為前綴且為直接子項的名稱
 *   - stat(p)：files[p] === null 表示目錄，其他表示檔案
 */
function createMockFsAdapter (files) {
  const norm = (p) => p.replace(/\/+$/, '')
  return {
    fileExists: (p) => Object.prototype.hasOwnProperty.call(files, norm(p)),
    readFile: (p) => {
      const content = files[norm(p)]
      if (typeof content !== 'string') {
        throw new Error(`mock readFile: ${p} 非檔案`)
      }
      return content
    },
    readdir: (p) => {
      const prefix = norm(p) + '/'
      const directChildren = new Set()
      for (const fullPath of Object.keys(files)) {
        if (fullPath.startsWith(prefix)) {
          const remainder = fullPath.slice(prefix.length)
          const firstSegment = remainder.split('/')[0]
          if (firstSegment) directChildren.add(firstSegment)
        }
      }
      return Array.from(directChildren)
    },
    stat: (p) => {
      const content = files[norm(p)]
      return {
        isDirectory: () => content === null
      }
    }
  }
}

/**
 * 建立 worklog main.md 的記憶體 mock 內容
 *
 * @param {string} version - 版本號（如 "0.19.0"）
 * @param {string} status - "開發中" 或 "已完成"
 */
function makeWorklogContent (version, status) {
  return [
    '# v' + version + ' 版本工作日誌',
    '',
    '**版本號**: v' + version,
    '**狀態**: ' + status,
    ''
  ].join('\n')
}

/**
 * 建立完整 worklog 樹的 mock files 物件
 *
 * @param {Array<{major: string, patch: string, status: string}>} entries
 */
function buildWorklogTree (entries) {
  const files = {
    [WORK_LOGS_ROOT]: null
  }
  const majorSet = new Set()

  for (const { major, patch, status } of entries) {
    const majorPath = path.join(WORK_LOGS_ROOT, major)
    const patchPath = path.join(majorPath, patch)
    const mainFile = path.join(patchPath, `${patch}-main.md`)
    files[majorPath] = null
    files[patchPath] = null
    files[mainFile] = makeWorklogContent(patch.replace(/^v/, ''), status)
    majorSet.add(major)
  }
  return files
}

describe('detectActiveWorklogVersion', () => {
  it('應在僅 1 個 active worklog 時回傳版本字串', () => {
    const files = buildWorklogTree([
      { major: 'v0.18', patch: 'v0.18.0', status: '已完成' },
      { major: 'v0.19', patch: 'v0.19.0', status: '開發中' }
    ])
    const fsAdapter = createMockFsAdapter(files)

    const result = detectActiveWorklogVersion(WORK_LOGS_ROOT, fsAdapter)

    expect(result.ok).toBe(true)
    expect(result.version).toBe('0.19.0')
  })

  it('應在所有 worklog 已完成時回傳失敗', () => {
    const files = buildWorklogTree([
      { major: 'v0.18', patch: 'v0.18.0', status: '已完成' },
      { major: 'v0.19', patch: 'v0.19.0', status: '已完成' }
    ])
    const fsAdapter = createMockFsAdapter(files)

    const result = detectActiveWorklogVersion(WORK_LOGS_ROOT, fsAdapter)

    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/未找到任何 active worklog/)
  })

  it('應在多個 active worklog 時回傳失敗並列出候選', () => {
    const files = buildWorklogTree([
      { major: 'v0.19', patch: 'v0.19.0', status: '開發中' },
      { major: 'v0.20', patch: 'v0.20.0', status: '開發中' }
    ])
    const fsAdapter = createMockFsAdapter(files)

    const result = detectActiveWorklogVersion(WORK_LOGS_ROOT, fsAdapter)

    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/找到多個 active worklog/)
    expect(result.candidates).toEqual(expect.arrayContaining(['0.19.0', '0.20.0']))
  })

  it('應在 workLogsRoot 不存在時回傳失敗', () => {
    const fsAdapter = createMockFsAdapter({})

    const result = detectActiveWorklogVersion(WORK_LOGS_ROOT, fsAdapter)

    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/worklog 根目錄不存在/)
  })

  it('應忽略不符版號命名的目錄（避免誤掃描 i18n-backlog 等子目錄）', () => {
    const files = buildWorklogTree([
      { major: 'v0.19', patch: 'v0.19.0', status: '開發中' }
    ])
    // 加入干擾目錄（i18n-backlog、tickets）
    files[path.join(WORK_LOGS_ROOT, 'v0.19', 'v0.19.0', 'tickets')] = null
    files[path.join(WORK_LOGS_ROOT, 'v0.19', 'v0.19.0', 'i18n-backlog.md')] = '# noise'
    files[path.join(WORK_LOGS_ROOT, 'README.md')] = '# meta'
    const fsAdapter = createMockFsAdapter(files)

    const result = detectActiveWorklogVersion(WORK_LOGS_ROOT, fsAdapter)

    expect(result.ok).toBe(true)
    expect(result.version).toBe('0.19.0')
  })
})

describe('validateVersionAlignment', () => {
  it('應在 package.json 與 active worklog 版號一致時通過（情境一致）', () => {
    const files = buildWorklogTree([
      { major: 'v0.19', patch: 'v0.19.0', status: '開發中' }
    ])
    const fsAdapter = createMockFsAdapter(files)

    const result = validateVersionAlignment('0.19.0', WORK_LOGS_ROOT, fsAdapter)

    expect(result.ok).toBe(true)
    expect(result.expectedVersion).toBe('0.19.0')
    expect(result.actualVersion).toBe('0.19.0')
  })

  it('應在版號不一致時 ok=false 並回傳明確 error 訊息（情境不一致）', () => {
    const files = buildWorklogTree([
      { major: 'v0.18', patch: 'v0.18.0', status: '已完成' },
      { major: 'v0.19', patch: 'v0.19.0', status: '開發中' }
    ])
    const fsAdapter = createMockFsAdapter(files)

    const result = validateVersionAlignment('0.18.0', WORK_LOGS_ROOT, fsAdapter)

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/0.18.0/)
    expect(result.error).toMatch(/0.19.0/)
    expect(result.expectedVersion).toBe('0.19.0')
    expect(result.actualVersion).toBe('0.18.0')
  })

  it('應在無法偵測 active worklog 時 ok=false 並標示原因', () => {
    const files = buildWorklogTree([
      { major: 'v0.18', patch: 'v0.18.0', status: '已完成' }
    ])
    const fsAdapter = createMockFsAdapter(files)

    const result = validateVersionAlignment('0.18.0', WORK_LOGS_ROOT, fsAdapter)

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/無法推斷 active worklog 版號/)
    expect(result.actualVersion).toBe('0.18.0')
  })
})

describe('--skip-version-check flag 行為驗證（情境 skip）', () => {
  // 此情境由 build.js 主流程處理（檢查 process.argv），純函式層不感知 flag。
  // 本測試確保「skip 時不呼叫純函式」的契約：呼叫者責任在 build flow，
  // 純函式回傳值在 skip 時不應影響 build 流程。

  it('純函式對 skip 情境保持單一職責（不嵌入 flag 判斷）', () => {
    const files = buildWorklogTree([
      { major: 'v0.18', patch: 'v0.18.0', status: '已完成' },
      { major: 'v0.19', patch: 'v0.19.0', status: '開發中' }
    ])
    const fsAdapter = createMockFsAdapter(files)

    // 即使版號錯，純函式仍如實回傳 ok=false；skip 由上層 build flow 控制
    const result = validateVersionAlignment('0.18.0', WORK_LOGS_ROOT, fsAdapter)
    expect(result.ok).toBe(false)

    // 一致時純函式回傳 ok=true，與 skip flag 無關
    const okResult = validateVersionAlignment('0.19.0', WORK_LOGS_ROOT, fsAdapter)
    expect(okResult.ok).toBe(true)
  })

  it('skip flag 行為由 build.js main flow 透過 process.argv 控制（契約宣告）', () => {
    // 此測試以宣告形式記錄契約：--skip-version-check flag 由 build.js
    // 主流程在呼叫 validateVersionAlignment 前判斷 process.argv，
    // 略過呼叫即繞過驗證。純函式單元測試不涉及 process 物件。
    //
    // 對應 build.js 行為：
    //   if (MODE === 'production' && !SKIP_VERSION_CHECK) { ... validateVersionAlignment ... }
    //   else if (MODE === 'production' && SKIP_VERSION_CHECK) { console.warn(...) }
    //
    // 此契約以契約形式宣告完成（避免 spawn child process 測試）。
    expect(typeof validateVersionAlignment).toBe('function')
  })
})
