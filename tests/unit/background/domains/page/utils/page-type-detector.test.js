/**
 * page-type-detector 共用工具測試（W1-039 DRY 收斂）
 *
 * 涵蓋兩個純函式：
 * - isReadmooPage：判斷 URL 是否屬於 Readmoo 網域
 * - detectReadmooPageType：偵測 Readmoo 頁面類型
 *
 * URL pattern 對齊 W1-029.1 修法：
 * - 真實書庫頁：https://read.readmoo.com/#/library（Vue SPA hash route）
 * - 舊版 path 形式：https://member.readmoo.com/library
 * - 書籍詳情、閱讀器、其他 readmoo.com 頁面
 *
 * 不含任何計時斷言（符合 test-assertion-design-rules）。
 */

const {
  isReadmooPage,
  detectReadmooPageType
} = require('src/background/domains/page/utils/page-type-detector')

describe('page-type-detector (W1-039)', () => {
  describe('isReadmooPage', () => {
    test('應將 https://readmoo.com/ 視為 Readmoo 頁面', () => {
      expect(isReadmooPage('https://readmoo.com/')).toBe(true)
    })

    test('應將 https://read.readmoo.com/#/library 視為 Readmoo 頁面', () => {
      expect(isReadmooPage('https://read.readmoo.com/#/library')).toBe(true)
    })

    test('應將 https://member.readmoo.com/library 視為 Readmoo 頁面', () => {
      expect(isReadmooPage('https://member.readmoo.com/library')).toBe(true)
    })

    test('非 Readmoo 域名應回傳 false', () => {
      expect(isReadmooPage('https://example.com/library')).toBe(false)
      expect(isReadmooPage('https://google.com/')).toBe(false)
    })

    test('空字串 / null / undefined 應回傳 false', () => {
      expect(isReadmooPage('')).toBe(false)
      expect(isReadmooPage(null)).toBe(false)
      expect(isReadmooPage(undefined)).toBe(false)
    })
  })

  describe('detectReadmooPageType', () => {
    describe('readmoo_library 偵測', () => {
      test('Vue SPA hash route：https://read.readmoo.com/#/library', () => {
        expect(detectReadmooPageType('https://read.readmoo.com/#/library')).toBe('readmoo_library')
      })

      test('舊版 path 形式：https://member.readmoo.com/library', () => {
        expect(detectReadmooPageType('https://member.readmoo.com/library')).toBe('readmoo_library')
      })

      test('readmoo.com/library 子字串（舊版相容）', () => {
        expect(detectReadmooPageType('https://www.readmoo.com/library')).toBe('readmoo_library')
      })

      test('read.readmoo.com 但無 #/library 不算 library', () => {
        expect(detectReadmooPageType('https://read.readmoo.com/')).toBe('readmoo_main')
      })
    })

    describe('readmoo_book_detail 偵測', () => {
      test('readmoo.com/book/{數字 id}', () => {
        expect(detectReadmooPageType('https://readmoo.com/book/123456')).toBe('readmoo_book_detail')
      })

      test('readmoo.com/book 無數字 id 不算 book_detail', () => {
        expect(detectReadmooPageType('https://readmoo.com/book/')).toBe('readmoo_main')
      })
    })

    describe('readmoo_reader 偵測', () => {
      test('readmoo.com/reader 路徑', () => {
        expect(detectReadmooPageType('https://readmoo.com/reader/abc123')).toBe('readmoo_reader')
      })
    })

    describe('readmoo_main fallback', () => {
      test('readmoo.com 根頁面', () => {
        expect(detectReadmooPageType('https://readmoo.com/')).toBe('readmoo_main')
      })

      test('readmoo.com 其他未分類路徑', () => {
        expect(detectReadmooPageType('https://readmoo.com/about')).toBe('readmoo_main')
      })
    })

    describe('非 Readmoo 與空值', () => {
      test('非 Readmoo 域名回傳 null', () => {
        expect(detectReadmooPageType('https://example.com/library')).toBeNull()
      })

      test('空字串回傳 null', () => {
        expect(detectReadmooPageType('')).toBeNull()
      })

      test('null 回傳 null', () => {
        expect(detectReadmooPageType(null)).toBeNull()
      })

      test('undefined 回傳 null', () => {
        expect(detectReadmooPageType(undefined)).toBeNull()
      })
    })

    describe('優先順序驗證（DRY 收斂保護）', () => {
      test('library 優先於 main：含 library 子字串不會落入 readmoo_main', () => {
        expect(detectReadmooPageType('https://readmoo.com/library/special')).toBe('readmoo_library')
      })

      test('book_detail 優先於 main：含 book/{id} 不會落入 readmoo_main', () => {
        expect(detectReadmooPageType('https://readmoo.com/book/9999')).toBe('readmoo_book_detail')
      })

      test('reader 優先於 main：含 reader 不會落入 readmoo_main', () => {
        expect(detectReadmooPageType('https://readmoo.com/reader')).toBe('readmoo_reader')
      })
    })
  })
})
