/**
 * Phase 2 測試群組 D：錯誤處理 + 日誌可觀測性（NFR）
 *
 * Ticket: 1.2.0-W1-002
 * 功能職責：catch / 錯誤路徑的 Logger 呼叫驗證（observability 規則 1）
 * 跨群組依賴：Logger（Mock）、mergeAllData（Mock）、chrome.storage.local（Mock）
 */

const { Logger } = require('src/core/logging/Logger')
const tagStorage = require('src/storage/adapters/tag-storage-adapter')

const { parseAndValidate, checkStaleness, executeImport } = require('src/import/json-importer')
const { createCanonicalJSON } = require('@tests/unit/import/fixtures')

let warnSpy
let errorSpy
let store

function installStatefulStorage () {
  store = {}
  chrome.storage.local.get.mockImplementation((keys, callback) => {
    const result = {}
    const keyList = Array.isArray(keys) ? keys : [keys]
    keyList.forEach(key => { result[key] = key in store ? store[key] : null })
    callback(result)
  })
  chrome.storage.local.set.mockImplementation((items, callback) => {
    Object.assign(store, items)
    if (callback) callback()
  })
}

beforeEach(() => {
  warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
  errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {})
  installStatefulStorage()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('錯誤處理日誌可觀測性（測試群組 D）', () => {
  test('NFR-1：parse 失敗 → Logger.warn 被呼叫', () => {
    parseAndValidate('not a json {')

    expect(warnSpy).toHaveBeenCalled()
  })

  test('NFR-2：格式辨識失敗 → Logger.warn 被呼叫', () => {
    parseAndValidate(JSON.stringify({ random: 'data' }))

    expect(warnSpy).toHaveBeenCalled()
  })

  test('NFR-3：totalBooks 不一致 → Logger.warn 被呼叫', () => {
    parseAndValidate(createCanonicalJSON({ bookCount: 8, totalBooks: 10 }))

    expect(warnSpy).toHaveBeenCalled()
  })

  test('NFR-4：stale data → Logger.warn 被呼叫', async () => {
    store.last_imported_at = '2026-06-20T10:00:00Z'
    jest.spyOn(tagStorage, 'mergeAllData').mockResolvedValue({ success: true, counts: {} })
    const fileContent = createCanonicalJSON({ bookCount: 1, exportedAt: '2026-06-19T00:00:00Z' })

    await executeImport(fileContent)

    expect(warnSpy).toHaveBeenCalled()
  })

  test('NFR-5：storage 失敗 → Logger.error 被呼叫', async () => {
    jest.spyOn(tagStorage, 'mergeAllData').mockResolvedValue({ success: false, error: 'storage_error' })
    const fileContent = createCanonicalJSON({ bookCount: 1, exportedAt: null })

    await executeImport(fileContent)

    expect(errorSpy).toHaveBeenCalled()
  })

  test('NFR-6：無效日期 → Logger.warn 被呼叫', async () => {
    store.last_imported_at = '2026-06-20T10:00:00Z'

    await checkStaleness('invalid-date-string')

    expect(warnSpy).toHaveBeenCalled()
  })
})
