/**
 * scripts/build.js 版號 sanity check 單元測試
 *
 * W1-083 SSOT 反轉：package.json 為唯一版本源，worklog 標記由 script 自動 sync。
 * 測試結構由三層組成：
 *   1. detectActiveWorklogVersion（保留，仍為公用工具）：以 worklog 標記偵測 active 版本
 *   2. validateVersionAlignment（反轉後）：以 package.json 為源，驗證對應 worklog 結構存在
 *   3. syncWorklogStatus（新增）：自動將對應 worklog 狀態標記同步為「開發中」
 *
 * 設計原則：
 *   - 純函式驗證 + fsAdapter/fsWriter 注入：與 W1-080 helper 介面對齊（createFullFsAdapter）
 *   - 寫入路徑採獨立 mock：避免讀寫責任混雜，sync 測試需驗證實際呼叫 writeFile
 *   - 三情境覆蓋（一致 / 不一致 auto-sync / worklog 不存在）對齊 W1-083 acceptance #3
 */

const path = require('path')
const {
  detectActiveWorklogVersion,
  validateVersionAlignment,
  syncWorklogStatus,
  resolveWorklogPath
} = require('../../../scripts/build')
const { createFullFsAdapter } = require('./script-test-helpers')

// W1-081：WORK_LOGS_ROOT 從 docs/work-logs/v0 上移至 docs/work-logs，
// 改為動態探測 v* major 目錄，支援 v0/v1 並存與 v1 only 情境。
const WORK_LOGS_ROOT = '/fake/docs/work-logs'

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

  for (const { major, patch, status, majorDir } of entries) {
    // W1-081：WORK_LOGS_ROOT 不再硬編碼 v0，buildWorklogTree 自 minor 版本目錄
    // （如 'v0.19'）前綴推斷對應的 major 目錄（'v0'），允許 majorDir 顯式 override
    // 以支援邊界情境（如 entries.major 為 'v1.0' 時自動使用 'v1'）。
    const inferredMajorDir = majorDir ?? major.split('.')[0]
    const majorVersionPath = path.join(WORK_LOGS_ROOT, inferredMajorDir)
    const minorPath = path.join(majorVersionPath, major)
    const patchPath = path.join(minorPath, patch)
    const mainFile = path.join(patchPath, `${patch}-main.md`)
    files[majorVersionPath] = null
    files[minorPath] = null
    files[patchPath] = null
    files[mainFile] = makeWorklogContent(patch.replace(/^v/, ''), status)
  }
  return files
}

/**
 * 建立寫入 mock，記錄所有 writeFile 呼叫供斷言
 */
function createFsWriterSpy () {
  const calls = []
  return {
    calls,
    writeFile: (p, content) => {
      calls.push({ path: p, content })
    }
  }
}

describe('resolveWorklogPath', () => {
  it('應正確推斷 M.m.p 版號的 worklog 路徑', () => {
    const result = resolveWorklogPath('0.19.0', WORK_LOGS_ROOT)

    expect(result.ok).toBe(true)
    expect(result.patchDir).toBe(path.join(WORK_LOGS_ROOT, 'v0', 'v0.19', 'v0.19.0'))
    expect(result.mainFile).toBe(
      path.join(WORK_LOGS_ROOT, 'v0', 'v0.19', 'v0.19.0', 'v0.19.0-main.md')
    )
  })

  it('應在版號格式不符 M.m.p 時 ok=false', () => {
    const result = resolveWorklogPath('0.19', WORK_LOGS_ROOT)

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/版號格式不符/)
  })

  it('應拒絕含 pre-release / build metadata 的版號', () => {
    const cases = ['0.19.0-beta', '0.19.0+build.1', '1.0.0-rc.1']
    for (const version of cases) {
      const result = resolveWorklogPath(version, WORK_LOGS_ROOT)
      expect(result.ok).toBe(false)
    }
  })

  it('W1-081：v1.0.0 應推斷至 v1/v1.0/v1.0.0 路徑（major 層動態化）', () => {
    // W1-081 核心：WORK_LOGS_ROOT 上移至 docs/work-logs/ 後，
    // resolveWorklogPath 需從 packageVersion 取 major 組裝 v{major} 目錄。
    // 此測試斷言 v1.0.0 推斷至 v1/v1.0/v1.0.0/ 而非 v0/v1.0/v1.0.0/。
    const result = resolveWorklogPath('1.0.0', WORK_LOGS_ROOT)

    expect(result.ok).toBe(true)
    expect(result.patchDir).toBe(path.join(WORK_LOGS_ROOT, 'v1', 'v1.0', 'v1.0.0'))
    expect(result.mainFile).toBe(
      path.join(WORK_LOGS_ROOT, 'v1', 'v1.0', 'v1.0.0', 'v1.0.0-main.md')
    )
  })

  it('W1-081：v2.3.4 應推斷至 v2/v2.3/v2.3.4 路徑（major 層通用化）', () => {
    // 防護 major dir 推斷邏輯對 v2+ 也正確（非僅 v0/v1 兩值 hardcode）
    const result = resolveWorklogPath('2.3.4', WORK_LOGS_ROOT)

    expect(result.ok).toBe(true)
    expect(result.patchDir).toBe(path.join(WORK_LOGS_ROOT, 'v2', 'v2.3', 'v2.3.4'))
  })
})

describe('detectActiveWorklogVersion（保留為公用工具）', () => {
  // W1-083 反轉後 detectActiveWorklogVersion 不再為 build sanity check 主入口，
  // 但作為公用工具仍供 version-release skill 或其他流程使用。測試保留以
  // 確保介面契約穩定。

  it('應在僅 1 個 active worklog 時回傳版本字串', () => {
    const files = buildWorklogTree([
      { major: 'v0.18', patch: 'v0.18.0', status: '已完成' },
      { major: 'v0.19', patch: 'v0.19.0', status: '開發中' }
    ])
    const fsAdapter = createFullFsAdapter(files)

    const result = detectActiveWorklogVersion(WORK_LOGS_ROOT, fsAdapter)

    expect(result.ok).toBe(true)
    expect(result.version).toBe('0.19.0')
  })

  it('應在所有 worklog 已完成時回傳失敗', () => {
    const files = buildWorklogTree([
      { major: 'v0.18', patch: 'v0.18.0', status: '已完成' },
      { major: 'v0.19', patch: 'v0.19.0', status: '已完成' }
    ])
    const fsAdapter = createFullFsAdapter(files)

    const result = detectActiveWorklogVersion(WORK_LOGS_ROOT, fsAdapter)

    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/未找到任何 active worklog/)
  })

  it('應在多個 active worklog 時回傳失敗並列出候選', () => {
    const files = buildWorklogTree([
      { major: 'v0.19', patch: 'v0.19.0', status: '開發中' },
      { major: 'v0.20', patch: 'v0.20.0', status: '開發中' }
    ])
    const fsAdapter = createFullFsAdapter(files)

    const result = detectActiveWorklogVersion(WORK_LOGS_ROOT, fsAdapter)

    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/找到多個 active worklog/)
    expect(result.candidates).toEqual(expect.arrayContaining(['0.19.0', '0.20.0']))
  })

  it('W1-081：v0/v1 並存時應正確找到唯一 active worklog（在 v1 內）', () => {
    // 業務情境：v0.19.0 已發布、wave 進入 v1.0.0，此時 docs/work-logs/ 下同時存在
    // v0/（含 v0.18.0、v0.19.0 均已完成）與 v1/（v1.0.0 開發中）。
    // 預期：detectActiveWorklogVersion 跨 major dir 掃描，正確回傳 '1.0.0'。
    const files = buildWorklogTree([
      { major: 'v0.18', patch: 'v0.18.0', status: '已完成' },
      { major: 'v0.19', patch: 'v0.19.0', status: '已完成' },
      { major: 'v1.0', patch: 'v1.0.0', status: '開發中' }
    ])
    const fsAdapter = createFullFsAdapter(files)

    const result = detectActiveWorklogVersion(WORK_LOGS_ROOT, fsAdapter)

    expect(result.ok).toBe(true)
    expect(result.version).toBe('1.0.0')
  })

  it('W1-081：v1 only 情境（無 v0 目錄）應正確找到 active worklog', () => {
    // 業務情境：未來時間點 v0 系列全部 archive 刪除後，僅剩 v1 目錄。
    // 預期：掃描邏輯不依賴 v0 存在性，能在 v1 only 情境下正確運作。
    const files = buildWorklogTree([
      { major: 'v1.0', patch: 'v1.0.0', status: '開發中' }
    ])
    const fsAdapter = createFullFsAdapter(files)

    const result = detectActiveWorklogVersion(WORK_LOGS_ROOT, fsAdapter)

    expect(result.ok).toBe(true)
    expect(result.version).toBe('1.0.0')
  })

  it('W1-081：跨 major dir 多 active 仍 fail-fast（架構上不應同時開發兩版本）', () => {
    // 確認 multi-active fail-fast 邏輯不受 major dir 擴展影響。
    // 跨 v0/v1 多 active 仍視為異常狀態（W1-081 用戶澄清：不應同時有多個 active）。
    const files = buildWorklogTree([
      { major: 'v0.19', patch: 'v0.19.0', status: '開發中' },
      { major: 'v1.0', patch: 'v1.0.0', status: '開發中' }
    ])
    const fsAdapter = createFullFsAdapter(files)

    const result = detectActiveWorklogVersion(WORK_LOGS_ROOT, fsAdapter)

    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/找到多個 active worklog/)
    expect(result.candidates).toEqual(expect.arrayContaining(['0.19.0', '1.0.0']))
  })

  it('應容忍全形冒號 U+FF1A 標記（W1-084 regex bug 修復）', () => {
    // W1-084: 原 regex [::] 兩字元皆為半形冒號 U+003A，註解卻聲稱支援全形。
    // syncWorklogStatus 已採顯式 [:：]（U+003A + U+FF1A），本測試確保
    // detectActiveWorklogVersion 對稱支援全形冒號，避免兩函式對「狀態」標記
    // 格式判定漂移（W1-083 PC-074 同源風險）。
    const files = {
      [WORK_LOGS_ROOT]: null,
      // W1-081：detectActiveWorklogVersion 跨 major dir 掃描，需明示 v0 major dir entry
      // 否則 readdir(WORK_LOGS_ROOT) 推得 'v0' 但 stat(v0).isDirectory() === false
      [path.join(WORK_LOGS_ROOT, 'v0')]: null,
      [path.join(WORK_LOGS_ROOT, 'v0', 'v0.19')]: null,
      [path.join(WORK_LOGS_ROOT, 'v0', 'v0.19', 'v0.19.0')]: null,
      // 使用顯式 U+FF1A 全形冒號（與 syncWorklogStatus 測試對稱）
      [path.join(WORK_LOGS_ROOT, 'v0', 'v0.19', 'v0.19.0', 'v0.19.0-main.md')]:
        '# v0.19.0 版本工作日誌\n\n**版本號**: v0.19.0\n**狀態**：開發中\n'
    }
    const fsAdapter = createFullFsAdapter(files)

    const result = detectActiveWorklogVersion(WORK_LOGS_ROOT, fsAdapter)

    expect(result.ok).toBe(true)
    expect(result.version).toBe('0.19.0')
  })
})

describe('validateVersionAlignment（W1-083 反轉：package.json 為 SSOT）', () => {
  it('情境一致：package.json 版號對應 worklog 目錄與 main.md 存在 -> ok=true', () => {
    const files = buildWorklogTree([
      { major: 'v0.19', patch: 'v0.19.0', status: '開發中' }
    ])
    const fsAdapter = createFullFsAdapter(files)

    const result = validateVersionAlignment('0.19.0', WORK_LOGS_ROOT, fsAdapter)

    expect(result.ok).toBe(true)
    expect(result.actualVersion).toBe('0.19.0')
    expect(result.expectedMainFile).toBe(
      path.join(WORK_LOGS_ROOT, 'v0', 'v0.19', 'v0.19.0', 'v0.19.0-main.md')
    )
  })

  it('情境一致：worklog 標記為「已完成」也通過 validate（標記不影響存在性斷言）', () => {
    // W1-083 反轉核心：validateVersionAlignment 只負責「結構存在性」，
    // 不再以「標記為開發中」為斷言條件。標記同步由 syncWorklogStatus 處理。
    const files = buildWorklogTree([
      { major: 'v0.19', patch: 'v0.19.0', status: '已完成' }
    ])
    const fsAdapter = createFullFsAdapter(files)

    const result = validateVersionAlignment('0.19.0', WORK_LOGS_ROOT, fsAdapter)

    expect(result.ok).toBe(true)
    expect(result.actualVersion).toBe('0.19.0')
  })

  it('情境 worklog 不存在：對應 patch 目錄缺失 -> ok=false 並指明缺失路徑', () => {
    const files = buildWorklogTree([
      { major: 'v0.18', patch: 'v0.18.0', status: '已完成' }
    ])
    const fsAdapter = createFullFsAdapter(files)

    const result = validateVersionAlignment('0.99.0', WORK_LOGS_ROOT, fsAdapter)

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/0.99.0/)
    expect(result.error).toMatch(/worklog 目錄不存在/)
    expect(result.actualVersion).toBe('0.99.0')
  })

  it('情境 worklog main.md 不存在：目錄存在但缺主檔案 -> ok=false', () => {
    // 模擬 docs/work-logs/v0/v0.20/v0.20.0/ 存在但無 v0.20.0-main.md
    // （罕見但需驗證，例：用戶 mkdir 後忘了建立 main.md）
    const fsAdapter = createFullFsAdapter({
      [WORK_LOGS_ROOT]: null,
      [path.join(WORK_LOGS_ROOT, 'v0', 'v0.20')]: null,
      [path.join(WORK_LOGS_ROOT, 'v0', 'v0.20', 'v0.20.0')]: null
    })

    const result = validateVersionAlignment('0.20.0', WORK_LOGS_ROOT, fsAdapter)

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/worklog 主檔案不存在/)
  })

  it('W1-081：v1.0.0 對應 worklog 目錄存在 -> ok=true（major dir 動態化）', () => {
    // W1-081：validate 需從 packageVersion='1.0.0' 推斷 v1/v1.0/v1.0.0 目錄並驗證存在
    const files = buildWorklogTree([
      { major: 'v1.0', patch: 'v1.0.0', status: '開發中' }
    ])
    const fsAdapter = createFullFsAdapter(files)

    const result = validateVersionAlignment('1.0.0', WORK_LOGS_ROOT, fsAdapter)

    expect(result.ok).toBe(true)
    expect(result.actualVersion).toBe('1.0.0')
    expect(result.expectedMainFile).toBe(
      path.join(WORK_LOGS_ROOT, 'v1', 'v1.0', 'v1.0.0', 'v1.0.0-main.md')
    )
  })

  it('W1-081：v1.0.0 對應 worklog 不存在（僅有 v0 系列）-> ok=false', () => {
    // v0 系列尚存但 v1 目錄尚未建立時的失敗情境
    const files = buildWorklogTree([
      { major: 'v0.19', patch: 'v0.19.0', status: '已完成' }
    ])
    const fsAdapter = createFullFsAdapter(files)

    const result = validateVersionAlignment('1.0.0', WORK_LOGS_ROOT, fsAdapter)

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/worklog 目錄不存在/)
    expect(result.error).toMatch(/1\.0\.0/)
  })

  it('情境版號格式錯：package.json 版號非 M.m.p -> ok=false', () => {
    const fsAdapter = createFullFsAdapter({ [WORK_LOGS_ROOT]: null })

    const result = validateVersionAlignment('0.19', WORK_LOGS_ROOT, fsAdapter)

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/版號格式不符/)
  })
})

describe('syncWorklogStatus（W1-083 新增：自動同步 worklog 狀態為開發中）', () => {
  it('情境標記為「已完成」-> 自動改寫為「開發中」並回傳 changed=true', () => {
    const files = buildWorklogTree([
      { major: 'v0.19', patch: 'v0.19.0', status: '已完成' }
    ])
    const fsAdapter = createFullFsAdapter(files)
    const fsWriter = createFsWriterSpy()

    const result = syncWorklogStatus('0.19.0', WORK_LOGS_ROOT, fsAdapter, fsWriter)

    expect(result.ok).toBe(true)
    expect(result.changed).toBe(true)
    expect(result.previousStatus).toBe('已完成')
    expect(fsWriter.calls).toHaveLength(1)

    const written = fsWriter.calls[0]
    expect(written.path).toBe(
      path.join(WORK_LOGS_ROOT, 'v0', 'v0.19', 'v0.19.0', 'v0.19.0-main.md')
    )
    expect(written.content).toMatch(/\*\*狀態\*\*: 開發中/)
    expect(written.content).not.toMatch(/\*\*狀態\*\*: 已完成/)
  })

  it('W1-081：v1.0.0 已完成 -> 自動改寫為開發中（major dir 動態化）', () => {
    // 確認 sync 路徑也正確支援 v1+ major dir
    const files = buildWorklogTree([
      { major: 'v1.0', patch: 'v1.0.0', status: '已完成' }
    ])
    const fsAdapter = createFullFsAdapter(files)
    const fsWriter = createFsWriterSpy()

    const result = syncWorklogStatus('1.0.0', WORK_LOGS_ROOT, fsAdapter, fsWriter)

    expect(result.ok).toBe(true)
    expect(result.changed).toBe(true)
    expect(result.previousStatus).toBe('已完成')
    expect(fsWriter.calls).toHaveLength(1)
    expect(fsWriter.calls[0].path).toBe(
      path.join(WORK_LOGS_ROOT, 'v1', 'v1.0', 'v1.0.0', 'v1.0.0-main.md')
    )
    expect(fsWriter.calls[0].content).toMatch(/\*\*狀態\*\*: 開發中/)
  })

  it('情境標記已為「開發中」-> no-op 且 changed=false（不重複寫入）', () => {
    const files = buildWorklogTree([
      { major: 'v0.19', patch: 'v0.19.0', status: '開發中' }
    ])
    const fsAdapter = createFullFsAdapter(files)
    const fsWriter = createFsWriterSpy()

    const result = syncWorklogStatus('0.19.0', WORK_LOGS_ROOT, fsAdapter, fsWriter)

    expect(result.ok).toBe(true)
    expect(result.changed).toBe(false)
    expect(result.previousStatus).toBe('開發中')
    expect(fsWriter.calls).toHaveLength(0)
  })

  it('情境 worklog main.md 不存在 -> ok=false（不寫入，交由 validate 階段處理）', () => {
    const fsAdapter = createFullFsAdapter({
      [WORK_LOGS_ROOT]: null
    })
    const fsWriter = createFsWriterSpy()

    const result = syncWorklogStatus('0.20.0', WORK_LOGS_ROOT, fsAdapter, fsWriter)

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/worklog 主檔案不存在/)
    expect(fsWriter.calls).toHaveLength(0)
  })

  it('情境標記為其他狀態（如「已棄用」）-> 仍改寫為「開發中」', () => {
    // 防護 worklog 標記漂移：未預期狀態值（如人工手寫的「已棄用」/「凍結」）
    // 都應由 sync 重置為「開發中」，避免 build:prod 後狀態仍不對齊
    const files = {
      [WORK_LOGS_ROOT]: null,
      [path.join(WORK_LOGS_ROOT, 'v0', 'v0.19')]: null,
      [path.join(WORK_LOGS_ROOT, 'v0', 'v0.19', 'v0.19.0')]: null,
      [path.join(WORK_LOGS_ROOT, 'v0', 'v0.19', 'v0.19.0', 'v0.19.0-main.md')]:
        '# v0.19.0\n\n**狀態**: 已棄用\n'
    }
    const fsAdapter = createFullFsAdapter(files)
    const fsWriter = createFsWriterSpy()

    const result = syncWorklogStatus('0.19.0', WORK_LOGS_ROOT, fsAdapter, fsWriter)

    expect(result.ok).toBe(true)
    expect(result.changed).toBe(true)
    expect(result.previousStatus).toBe('已棄用')
    expect(fsWriter.calls[0].content).toMatch(/\*\*狀態\*\*: 開發中/)
  })

  it('情境 main.md 缺「**狀態**」標記行 -> ok=false 並標示結構異常', () => {
    const files = {
      [WORK_LOGS_ROOT]: null,
      [path.join(WORK_LOGS_ROOT, 'v0', 'v0.19')]: null,
      [path.join(WORK_LOGS_ROOT, 'v0', 'v0.19', 'v0.19.0')]: null,
      [path.join(WORK_LOGS_ROOT, 'v0', 'v0.19', 'v0.19.0', 'v0.19.0-main.md')]:
        '# v0.19.0\n\n沒有狀態標記\n'
    }
    const fsAdapter = createFullFsAdapter(files)
    const fsWriter = createFsWriterSpy()

    const result = syncWorklogStatus('0.19.0', WORK_LOGS_ROOT, fsAdapter, fsWriter)

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/缺少「\*\*狀態\*\*: ...」標記行/)
    expect(fsWriter.calls).toHaveLength(0)
  })

  it('情境全形冒號標記 -> 容忍並正確改寫', () => {
    // 對齊 detectActiveWorklogVersion 的全形冒號容忍邏輯
    const files = {
      [WORK_LOGS_ROOT]: null,
      [path.join(WORK_LOGS_ROOT, 'v0', 'v0.19')]: null,
      [path.join(WORK_LOGS_ROOT, 'v0', 'v0.19', 'v0.19.0')]: null,
      [path.join(WORK_LOGS_ROOT, 'v0', 'v0.19', 'v0.19.0', 'v0.19.0-main.md')]:
        '# v0.19.0\n\n**狀態**：已完成\n'
    }
    const fsAdapter = createFullFsAdapter(files)
    const fsWriter = createFsWriterSpy()

    const result = syncWorklogStatus('0.19.0', WORK_LOGS_ROOT, fsAdapter, fsWriter)

    expect(result.ok).toBe(true)
    expect(result.changed).toBe(true)
    expect(fsWriter.calls[0].content).toMatch(/\*\*狀態\*\*：開發中/)
  })
})

describe('--skip-version-check flag 行為宣告', () => {
  // W1-083 後 --skip-version-check 同時略過 validate + sync 兩階段。
  // 純函式對 flag 不感知，由 build.js main flow 在呼叫前判斷 process.argv。

  it('純函式對 skip 情境保持單一職責（不嵌入 flag 判斷）', () => {
    const files = buildWorklogTree([
      { major: 'v0.19', patch: 'v0.19.0', status: '開發中' }
    ])
    const fsAdapter = createFullFsAdapter(files)

    // 即使版號錯，純函式仍如實回傳 ok=false；skip 由上層 build flow 控制
    const badResult = validateVersionAlignment('0.99.0', WORK_LOGS_ROOT, fsAdapter)
    expect(badResult.ok).toBe(false)

    // 一致時純函式回傳 ok=true，與 skip flag 無關
    const okResult = validateVersionAlignment('0.19.0', WORK_LOGS_ROOT, fsAdapter)
    expect(okResult.ok).toBe(true)
  })

  it('skip flag 行為由 build.js main flow 透過 process.argv 控制（契約宣告）', () => {
    // 此測試以宣告形式記錄契約：--skip-version-check flag 由 build.js
    // 主流程在呼叫 validate / sync 前判斷 process.argv，略過呼叫即繞過驗證。
    expect(typeof validateVersionAlignment).toBe('function')
    expect(typeof syncWorklogStatus).toBe('function')
  })
})
