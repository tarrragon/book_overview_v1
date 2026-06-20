/**
 * Phase 2 測試群組 B：checkStaleness（BU-3）
 *
 * Ticket: 1.2.0-W1-002
 * 功能職責：防舊蓋新檢查
 * 跨群組依賴：chrome.storage.local（Mock）
 */

const { checkStaleness } = require('src/import/json-importer')

/**
 * 覆寫 chrome.storage.local.get，使讀 last_imported_at 回傳指定值。
 * test-setup 預設回傳 null，此處針對性注入。
 */
function mockLastImportedAt (value) {
  chrome.storage.local.get.mockImplementation((keys, callback) => {
    const result = {}
    const keyList = Array.isArray(keys) ? keys : [keys]
    keyList.forEach(key => {
      result[key] = key === 'last_imported_at' ? value : null
    })
    callback(result)
  })
}

describe('checkStaleness（測試群組 B）', () => {
  test('A2-1：exportedAt 較新 → isStale false', async () => {
    mockLastImportedAt('2026-06-18T10:00:00Z')

    const result = await checkStaleness('2026-06-20T10:00:00Z')

    expect(result.isStale).toBe(false)
  })

  test('E2-1：exportedAt 較舊 → isStale true', async () => {
    mockLastImportedAt('2026-06-20T10:00:00Z')

    const result = await checkStaleness('2026-06-19T08:00:00Z')

    expect(result.isStale).toBe(true)
  })

  test('B2-1：exportedAt 為 null → isStale false', async () => {
    mockLastImportedAt('2026-06-20T10:00:00Z')

    const result = await checkStaleness(null)

    expect(result.isStale).toBe(false)
  })

  test('B2-2：首次匯入（lastImportedAt 不存在）→ isStale false', async () => {
    mockLastImportedAt(null)

    const result = await checkStaleness('2026-06-20T10:00:00Z')

    expect(result.isStale).toBe(false)
    expect(result.lastImportedAt).toBeNull()
  })

  test('B2-3：兩者都 null → isStale false', async () => {
    mockLastImportedAt(null)

    const result = await checkStaleness(null)

    expect(result.isStale).toBe(false)
  })

  test('B2-4：時間相等 → isStale false', async () => {
    mockLastImportedAt('2026-06-20T10:00:00Z')

    const result = await checkStaleness('2026-06-20T10:00:00Z')

    expect(result.isStale).toBe(false)
  })

  test('B2-5：無效日期格式 → isStale false', async () => {
    mockLastImportedAt('2026-06-20T10:00:00Z')

    const result = await checkStaleness('invalid-date-string')

    expect(result.isStale).toBe(false)
  })
})
