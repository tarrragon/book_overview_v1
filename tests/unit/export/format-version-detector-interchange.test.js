'use strict'

/**
 * detectInterchangeSource 四來源辨識測試（Group A）+ detectFormatVersion B5 回歸
 *
 * 對應 ticket 0.19.0-W4-031.2.3（Phase 3b-A）；
 * 設計 SSOT：ticket 0.19.0-W4-031.2 §Phase 1 §3（U1-U5/B1-B5）、§Phase 2 Group A、
 * §Phase 3a §2 控制流虛擬碼；格式 SSOT：docs/spec/book-interchange-v1.md v3.0.0 §8。
 *
 * 斷言策略：純判定函式，斷言回傳 enum 值；不 throw（無 throw 斷言）。
 * 無計時斷言（遵循 .claude/rules/core/test-assertion-design-rules.md 規則 1/4）。
 */

const {
  detectInterchangeSource,
  detectFormatVersion
} = require('../../../src/export/format-version-detector')

// --- 本地 fixture factory（各案例獨立建構，避免共享物件參考污染）---

function makeCanonicalRoot (overrides = {}) {
  return {
    format: 'book-interchange-v1',
    formatVersion: '3.0.0',
    metadata: { exportedAt: '2026-06-02T00:00:00.000Z' },
    books: [{ id: 'b1', title: '挪威的森林' }],
    ...overrides
  }
}

function makeV2Root (overrides = {}) {
  return {
    metadata: { formatVersion: '2.0.0' },
    books: [],
    ...overrides
  }
}

function makeBackupInfoRoot (overrides = {}) {
  return {
    backup_info: { app: 'book_overview_app', version: '1.0.0' },
    books: [{ id: 'b1', title: 'APP Book' }],
    ...overrides
  }
}

function makeExportInfoRoot (overrides = {}) {
  return {
    export_info: { app: 'book_overview_app' },
    books: [{ id: 'b1', title: 'APP Book' }],
    ...overrides
  }
}

describe('detectInterchangeSource — 四來源辨識（Group A）', () => {
  // 場景 A-U1：canonical 來源辨識（場景 1）
  test('U1 canonical — format === book-interchange-v1 回傳 canonical', () => {
    const data = makeCanonicalRoot()
    // 前置驗證：fixture 正確建構
    expect(data.format).toBe('book-interchange-v1')
    expect(detectInterchangeSource(data)).toBe('canonical')
  })

  // 場景 A-U2：內部 v2 來源辨識（場景 2）
  test('U2 v2 — metadata.formatVersion 以 2. 開頭且無 format 回傳 v2', () => {
    const data = makeV2Root()
    // 前置驗證：確認非 canonical 路徑
    expect(data.format).toBeUndefined()
    expect(detectInterchangeSource(data)).toBe('v2')
  })

  // 場景 A-U3a：APP legacy（backup_info wrapper）辨識（場景 3，止血關鍵）
  test('U3a app-legacy — backup_info wrapper + books 回傳 app-legacy', () => {
    const data = makeBackupInfoRoot()
    // 前置驗證：backup_info 存在 AND books 為陣列 AND 無 format
    expect(data.backup_info).toBeDefined()
    expect(Array.isArray(data.books)).toBe(true)
    expect(data.format).toBeUndefined()
    expect(detectInterchangeSource(data)).toBe('app-legacy')
  })

  // 場景 A-U3b：APP legacy（export_info wrapper）辨識
  test('U3b app-legacy — export_info wrapper + books 回傳 app-legacy', () => {
    const data = makeExportInfoRoot()
    // 前置驗證
    expect(data.export_info).toBeDefined()
    expect(Array.isArray(data.books)).toBe(true)
    expect(detectInterchangeSource(data)).toBe('app-legacy')
  })

  // 場景 A-U4：flat v1（純陣列）辨識（場景 4）
  test('U4 v1 — 純陣列回傳 v1', () => {
    const data = [{ id: '1', title: 'Book' }]
    // 前置驗證
    expect(Array.isArray(data)).toBe(true)
    expect(detectInterchangeSource(data)).toBe('v1')
  })

  // 場景 A-U5：flat v1（wrapper 無版本標記）辨識
  test('U5 v1 — {books:[]} 無版本標記回傳 v1', () => {
    const data = { books: [{ id: '1', title: 'Book' }] }
    // 前置驗證：無 format/metadata/backup_info/export_info AND books 為陣列
    expect(data.format).toBeUndefined()
    expect(data.metadata).toBeUndefined()
    expect(data.backup_info).toBeUndefined()
    expect(data.export_info).toBeUndefined()
    expect(Array.isArray(data.books)).toBe(true)
    expect(detectInterchangeSource(data)).toBe('v1')
  })

  // 場景 A-B1：非物件防禦
  test('B1 非物件 — null/undefined/數字/字串回傳 null（不 throw）', () => {
    expect(detectInterchangeSource(null)).toBe(null)
    expect(detectInterchangeSource(undefined)).toBe(null)
    expect(detectInterchangeSource(123)).toBe(null)
    expect(detectInterchangeSource('string')).toBe(null)
  })

  // 場景 A-B2：空物件防禦
  test('B2 空物件 — {} 回傳 null', () => {
    expect(detectInterchangeSource({})).toBe(null)
  })

  // 場景 A-B3：優先序衝突 — format 凌駕 formatVersion
  test('B3 優先序 — format 與 formatVersion 同在時回傳 canonical（優先序 1 勝）', () => {
    const data = {
      format: 'book-interchange-v1',
      metadata: { formatVersion: '2.0.0' },
      books: []
    }
    // 前置驗證：兩條件同時成立
    expect(data.format).toBe('book-interchange-v1')
    expect(data.metadata.formatVersion).toBe('2.0.0')
    expect(detectInterchangeSource(data)).toBe('canonical')
  })

  // 場景 A-B4：優先序衝突 — format 凌駕 backup_info
  test('B4 優先序 — format 與 backup_info 同在時回傳 canonical（優先序 1 勝）', () => {
    const data = {
      format: 'book-interchange-v1',
      backup_info: { app: 'x' },
      books: []
    }
    // 前置驗證：兩條件同時成立
    expect(data.format).toBe('book-interchange-v1')
    expect(data.backup_info).toBeDefined()
    expect(detectInterchangeSource(data)).toBe('canonical')
  })
})

describe('detectFormatVersion — B5 既有二值語意回歸保護', () => {
  // 場景 A-B5：既有 detectFormatVersion 對 v2/v1/null fixture 行為不變
  // （防 ContentParser DI 回歸；委派 detectInterchangeSource 後值域收斂）

  test('B5 v2 明確版本號 — metadata.formatVersion 以 2. 開頭回傳 v2', () => {
    const data = { metadata: { formatVersion: '2.0.0' }, books: [] }
    expect(detectFormatVersion(data)).toBe('v2')
  })

  test('B5 v2 隱含偵測 — metadata + books 含 readingStatus 回傳 v2', () => {
    const data = {
      metadata: { source: 'test' },
      books: [{ id: '1', readingStatus: 'reading' }]
    }
    expect(detectFormatVersion(data)).toBe('v2')
  })

  test('B5 v1 純陣列 — 回傳 v1', () => {
    const data = [{ id: '1', title: 'Book' }]
    expect(detectFormatVersion(data)).toBe('v1')
  })

  test('B5 v1 wrapper — {books:[]} 無 formatVersion 回傳 v1', () => {
    const data = { books: [{ id: '1', category: 'Fiction' }] }
    expect(detectFormatVersion(data)).toBe('v1')
  })

  test('B5 非物件 — null/undefined/數字/字串回傳 null', () => {
    expect(detectFormatVersion(null)).toBe(null)
    expect(detectFormatVersion(undefined)).toBe(null)
    expect(detectFormatVersion(123)).toBe(null)
    expect(detectFormatVersion('string')).toBe(null)
  })

  test('B5 物件但無 books — 回傳 null', () => {
    expect(detectFormatVersion({ foo: 'bar' })).toBe(null)
  })

  // 委派收斂語意確認（H1/ADR-2）：canonical/app-legacy 在既有二值語意下回 null
  test('canonical 來源在 detectFormatVersion 收斂為 null（二值消費端不消費）', () => {
    const data = makeCanonicalRoot()
    expect(detectFormatVersion(data)).toBe(null)
  })

  test('app-legacy 來源在 detectFormatVersion 收斂為 null（接線走 .2.2 新 detector）', () => {
    expect(detectFormatVersion(makeBackupInfoRoot())).toBe(null)
    expect(detectFormatVersion(makeExportInfoRoot())).toBe(null)
  })
})
