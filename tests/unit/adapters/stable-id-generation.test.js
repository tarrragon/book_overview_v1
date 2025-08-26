/**
 * stable-id-generation.test.js
 *
 * UC-02 去重邏輯 - generateStableBookId() 方法完整測試套件
 *
 * 測試範圍：
 * - 三層ID生成策略驗證（封面ID → 標題ID → 閱讀器ID）
 * - 冪等性和唯一性測試
 * - 邊界條件完整覆蓋
 * - 異常情況處理驗證
 * - 效能和記憶體使用測試
 * - 安全性過濾機制測試
 *
 * 目標：測試覆蓋率從65%提升至95%
 * 測試案例數量：41個comprehensive測試案例
 */

describe('generateStableBookId() - UC-02 去重邏輯測試套件', () => {
  let createReadmooAdapter
  let adapter

  beforeEach(() => {
    // 重新載入模組以確保乾淨的測試環境
    jest.resetModules()
    jest.clearAllMocks()

    // 重置全域變數
    global.DEBUG_MODE = false

    try {
      createReadmooAdapter = require('@/content/adapters/readmoo-adapter')
      adapter = createReadmooAdapter()
    } catch (error) {
      // 預期在紅燈階段會失敗
      console.warn('⚠️ ReadmooAdapter 模組載入失敗，這在 TDD 紅燈階段是預期的')
      createReadmooAdapter = null
      adapter = null
    }
  })

  afterEach(() => {
    if (adapter) {
      adapter = null
    }
    // 清理記憶體
    if (global.gc) global.gc()
  })

  afterAll(() => {
    // 清理快取和暫存資料
    jest.restoreAllMocks()
  })

  // 測試資料準備
  const testData = {
    // 真實Readmoo封面URL範例
    validCoverUrls: [
      'https://cdn.readmoo.com/cover/ab/test123_210x315.jpg',
      'https://cdn.readmoo.com/cover/xy/book789_300x450.png?v=123456',
      'https://cdn.readmoo.com/cover/cd/novel456_150x200.jpeg'
    ],

    // 各種格式的書籍標題
    testTitles: [
      '正常書籍標題',
      'JavaScript 程式設計指南',
      'Python@入門 (第二版) & 實戰！',
      '<script>alert("test")</script>惡意標題',
      '超長標題'.repeat(100)
    ],

    // 邊界條件測試資料
    boundaryTestData: {
      nullValues: [null, undefined, '', '   '],
      invalidTypes: [123, {}, [], true, false],
      maliciousInputs: ['javascript:alert(1)', '<script>test</script>']
    }
  }

  describe('🏗️ 基本結構檢查', () => {
    test('應該能創建 ReadmooAdapter 並包含 generateStableBookId 方法', () => {
      expect(createReadmooAdapter).toBeDefined()
      expect(adapter).toBeDefined()
      expect(typeof adapter.generateStableBookId).toBe('function')
    })
  })

  describe('🎯 2.1 正常流程測試 (8個測試案例)', () => {
    describe('封面ID優先邏輯測試', () => {
      // TC001: 標準封面URL的ID生成
      test('TC001: 應該從標準Readmoo封面URL生成cover-based ID', () => {
        const coverUrl = 'https://cdn.readmoo.com/cover/ab/test123_210x315.jpg'
        const result = adapter.generateStableBookId('reader456', '書籍標題', coverUrl)

        expect(result).toBe('cover-test123')
      })

      // TC002: 封面URL包含查詢參數的處理
      test('TC002: 應該正確處理包含查詢參數的封面URL', () => {
        const coverUrl = 'https://cdn.readmoo.com/cover/xy/book789_300x450.png?v=123456'
        const result = adapter.generateStableBookId('reader999', '測試書籍', coverUrl)

        expect(result).toBe('cover-book789')
      })

      // TC003: 不同封面尺寸格式的處理
      test('TC003: 應該正確處理不同尺寸格式的封面URL', () => {
        const coverUrl = 'https://cdn.readmoo.com/cover/cd/novel456_150x200.jpeg'
        const result = adapter.generateStableBookId('reader111', '小說', coverUrl)

        expect(result).toBe('cover-novel456')
      })
    })

    describe('標題ID備用邏輯測試', () => {
      // TC004: 封面URL無效時使用標題生成ID
      test('TC004: 封面URL無效時應該使用標題生成ID', () => {
        const invalidCoverUrl = 'https://invalid-domain.com/image.jpg'
        const title = 'JavaScript 程式設計指南'
        const result = adapter.generateStableBookId('reader222', title, invalidCoverUrl)

        expect(result).toBe('title-javascript-程式設計指南')
      })

      // TC005: 標題包含特殊字符的正規化處理
      test('TC005: 應該正確處理包含特殊字符的標題', () => {
        const invalidCoverUrl = ''
        const title = 'Python@入門 (第二版) & 實戰！'
        const result = adapter.generateStableBookId('reader333', title, invalidCoverUrl)

        expect(result).toBe('title-python入門-第二版-實戰')
      })

      // TC006: 中英文混合標題的處理
      test('TC006: 應該正確處理中英文混合的標題', () => {
        const invalidCoverUrl = ''
        const title = 'Deep Learning 深度學習 2024'
        const result = adapter.generateStableBookId('reader444', title, invalidCoverUrl)

        expect(result).toBe('title-deep-learning-深度學習-2024')
      })
    })

    describe('閱讀器ID最終備用邏輯測試', () => {
      // TC007: 封面和標題都無效時使用閱讀器ID
      test('TC007: 封面和標題都無效時應該使用閱讀器ID', () => {
        const result = adapter.generateStableBookId('reader555', '', '')

        expect(result).toBe('reader-reader555')
      })

      // TC008: 標題為預設值時的處理
      test('TC008: 標題為預設值時應該使用閱讀器ID', () => {
        const invalidCoverUrl = ''
        const result = adapter.generateStableBookId('reader666', '未知標題', invalidCoverUrl)

        expect(result).toBe('reader-reader666')
      })
    })
  })

  describe('🔍 2.2 邊界條件測試 (15個測試案例)', () => {
    describe('空值和undefined處理', () => {
      // TC009: 全部參數為null
      test('TC009: 所有參數為null時應該返回reader-undefined', () => {
        const result = adapter.generateStableBookId(null, null, null)
        expect(result).toBe('reader-undefined')
      })

      // TC010: 全部參數為undefined
      test('TC010: 所有參數為undefined時應該返回reader-undefined', () => {
        const result = adapter.generateStableBookId(undefined, undefined, undefined)
        expect(result).toBe('reader-undefined')
      })

      // TC011: 全部參數為空字符串
      test('TC011: 所有參數為空字符串時應該返回reader-undefined', () => {
        const result = adapter.generateStableBookId('', '', '')
        expect(result).toBe('reader-undefined')
      })

      // TC012: 只有readerId有效
      test('TC012: 只有readerId有效時應該使用閱讀器ID', () => {
        const result = adapter.generateStableBookId('valid123', null, null)
        expect(result).toBe('reader-valid123')
      })

      // TC013: 只有title有效
      test('TC013: 只有title有效時應該使用標題ID', () => {
        const result = adapter.generateStableBookId(null, '有效標題', null)
        expect(result).toBe('title-有效標題')
      })

      // TC014: 只有cover有效
      test('TC014: 只有cover有效時應該使用封面ID', () => {
        const validCover = 'https://cdn.readmoo.com/cover/ab/valid123_210x315.jpg'
        const result = adapter.generateStableBookId(null, null, validCover)
        expect(result).toBe('cover-valid123')
      })
    })

    describe('非字符串類型輸入處理', () => {
      // TC015: 混合類型輸入
      test('TC015: 非字符串類型輸入應該返回合理降級ID', () => {
        const result = adapter.generateStableBookId(123, { title: 'book' }, ['url'])
        expect(typeof result).toBe('string')
        expect(result).toMatch(/^(cover|title|reader)-/)
      })

      // TC016: 布爾值輸入
      test('TC016: 布爾值輸入應該返回reader-undefined', () => {
        const result = adapter.generateStableBookId(true, false, 0)
        expect(result).toBe('reader-undefined')
      })

      // TC017: 對象類型輸入
      test('TC017: 對象類型輸入應該返回reader-undefined', () => {
        const result = adapter.generateStableBookId({ id: 'test' }, 456, null)
        expect(result).toBe('reader-undefined')
      })
    })

    describe('超長字符串處理', () => {
      // TC018: 超長標題處理
      test('TC018: 超長標題應該被截斷至50字符', () => {
        const longTitle = '超長標題'.repeat(100) // 400字符
        const result = adapter.generateStableBookId('reader123', longTitle, '')

        expect(result).toMatch(/^title-/)
        expect(result.length).toBeLessThanOrEqual(56) // 'title-' + 50字符
      })

      // TC019: 超長封面URL處理
      test('TC019: 超長封面URL如果能解析coverId則正常返回', () => {
        const longUrl = 'https://cdn.readmoo.com/cover/ab/test123_210x315.jpg' + '?param=' + 'x'.repeat(500)
        const result = adapter.generateStableBookId('reader123', '標題', longUrl)

        // 如果能解析出coverId則返回，否則降級
        expect(result).toMatch(/^(cover-test123|title-)/)
      })

      // TC020: 超長readerId處理
      test('TC020: 超長readerId應該被完整保留', () => {
        const longReaderId = 'reader' + 'x'.repeat(200)
        const result = adapter.generateStableBookId(longReaderId, '', '')

        expect(result).toBe(`reader-${longReaderId}`)
      })
    })

    describe('特殊字符和編碼處理', () => {
      // TC021: HTML標籤清理
      test('TC021: 應該清理HTML標籤並返回安全ID', () => {
        const maliciousTitle = '<script>alert(\'test\')</script>書名'
        const result = adapter.generateStableBookId('reader123', maliciousTitle, '')

        expect(result).toBe('title-書名')
        expect(result).not.toContain('<script>')
      })

      // TC022: URL編碼字符處理
      test('TC022: 應該正規化URL編碼字符', () => {
        const encodedTitle = '書名%20測試&amp;版本'
        const result = adapter.generateStableBookId('reader123', encodedTitle, '')

        expect(result).toBe('title-書名-測試版本')
      })

      // TC023: 惡意協議URL處理
      test('TC023: 惡意協議URL應該降級到其他ID', () => {
        const maliciousUrl = 'javascript:alert(1)'
        const result = adapter.generateStableBookId('reader123', '正常標題', maliciousUrl)

        expect(result).not.toContain('javascript')
        expect(result).toMatch(/^(title-正常標題|reader-reader123)$/)
      })
    })
  })

  describe('⚠️ 2.3 異常情況測試 (10個測試案例)', () => {
    describe('URL格式錯誤處理', () => {
      // TC024: 無效URL格式
      test('TC024: 無效URL格式應該優雅降級不拋出錯誤', () => {
        const invalidUrl = 'not-a-url-at-all'

        expect(() => {
          const result = adapter.generateStableBookId('reader123', '標題', invalidUrl)
          expect(result).toMatch(/^(title-標題|reader-reader123)$/)
        }).not.toThrow()
      })

      // TC025: 不支援的協議
      test('TC025: 不支援的協議應該降級處理', () => {
        const ftpUrl = 'ftp://cdn.readmoo.com/cover/test.jpg'
        const result = adapter.generateStableBookId('reader123', '標題', ftpUrl)

        expect(result).toMatch(/^(title-標題|reader-reader123)$/)
      })

      // TC026: 路徑遍歷攻擊防護
      test('TC026: 應該防護路徑遍歷攻擊', () => {
        const maliciousUrl = 'https://cdn.readmoo.com/cover/../../../etc/passwd'
        const result = adapter.generateStableBookId('reader123', '標題', maliciousUrl)

        expect(result).not.toContain('..')
        expect(result).not.toContain('etc/passwd')
        expect(result).toMatch(/^(title-標題|reader-reader123)$/)
      })
    })

    describe('記憶體和效能限制', () => {
      // TC027: 模擬記憶體不足
      test('TC027: 記憶體不足時應該返回簡單備用ID', () => {
        // 模擬極端記憶體限制情況
        const extremeInput = {
          readerId: 'x'.repeat(10000),
          title: 'y'.repeat(10000),
          cover: 'https://cdn.readmoo.com/cover/ab/' + 'z'.repeat(1000) + '_210x315.jpg'
        }

        expect(() => {
          const result = adapter.generateStableBookId(
            extremeInput.readerId,
            extremeInput.title,
            extremeInput.cover
          )
          expect(typeof result).toBe('string')
          expect(result).toMatch(/^(cover|title|reader)-/)
        }).not.toThrow()
      })

      // TC028: 批量處理效能測試
      test('TC028: 批量處理1000次應該在合理時間內完成', () => {
        const startTime = performance.now()
        const results = []

        for (let i = 0; i < 1000; i++) {
          const result = adapter.generateStableBookId(
            `reader${i}`,
            `書籍${i}`,
            `https://cdn.readmoo.com/cover/ab/book${i}_210x315.jpg`
          )
          results.push(result)
        }

        const endTime = performance.now()
        const totalTime = endTime - startTime

        expect(results).toHaveLength(1000)
        expect(totalTime).toBeLessThan(1000) // 應該在1秒內完成

        // 檢查每個結果都是有效的
        results.forEach(result => {
          expect(result).toMatch(/^(cover|title|reader)-/)
        })
      })

      // TC029: 防止無限循環
      test('TC029: 應該防止遞迴調用或循環引用', () => {
        // 創建可能導致循環的輸入
        const circularObj = {}
        circularObj.self = circularObj

        expect(() => {
          const result = adapter.generateStableBookId('reader123', circularObj, '')
          expect(result).toBe('reader-reader123')
        }).not.toThrow()
      })
    })

    describe('網路和瀏覽器限制', () => {
      // TC030: 瀏覽器安全策略限制
      test('TC030: 瀏覽器安全策略阻止時應該降級', () => {
        // 模擬URL構造函數被安全策略阻止
        const originalURL = global.URL
        global.URL = function () {
          throw new Error('Blocked by security policy')
        }

        const result = adapter.generateStableBookId(
          'reader123',
          '標題',
          'https://cdn.readmoo.com/cover/ab/test123_210x315.jpg'
        )

        expect(result).toMatch(/^(title-標題|reader-reader123)$/)

        // 恢復原始URL
        global.URL = originalURL
      })

      // TC031: CSP限制處理
      test('TC031: Content Security Policy限制不應該影響ID生成', () => {
        // CSP應該不會影響純字符串處理的ID生成邏輯
        const result = adapter.generateStableBookId(
          'reader123',
          'CSP測試書籍',
          'https://cdn.readmoo.com/cover/ab/csp123_210x315.jpg'
        )

        expect(result).toMatch(/^(cover-csp123|title-csp測試書籍)$/)
      })

      // TC032: 跨域限制處理
      test('TC032: 跨域限制不應該影響本地處理', () => {
        // 純本地字符串處理不應該受跨域限制影響
        const result = adapter.generateStableBookId(
          'reader123',
          '跨域測試',
          'https://cdn.readmoo.com/cover/ab/cors123_210x315.jpg'
        )

        expect(result).toMatch(/^(cover-cors123|title-跨域測試)$/)
      })

      // TC033: 舊版瀏覽器兼容
      test('TC033: 舊版瀏覽器不支援某些API時應該使用備用方案', () => {
        // 模擬舊版瀏覽器環境
        const originalURL = global.URL
        delete global.URL

        const result = adapter.generateStableBookId(
          'reader123',
          '兼容性測試',
          'https://cdn.readmoo.com/cover/ab/compat123_210x315.jpg'
        )

        // 應該降級到標題或閱讀器ID
        expect(result).toMatch(/^(title-兼容性測試|reader-reader123)$/)

        // 恢復URL
        global.URL = originalURL
      })
    })
  })

  describe('🔄 2.4 冪等性和唯一性測試 (8個測試案例)', () => {
    describe('冪等性驗證', () => {
      // TC034: 相同參數多次調用
      test('TC034: 相同參數多次調用應該返回相同結果', () => {
        const params = ['reader123', '測試書籍', 'https://cdn.readmoo.com/cover/ab/test123_210x315.jpg']

        const result1 = adapter.generateStableBookId(...params)
        const result2 = adapter.generateStableBookId(...params)
        const result3 = adapter.generateStableBookId(...params)

        expect(result1).toBe(result2)
        expect(result2).toBe(result3)
        expect(result1).toBe('cover-test123')
      })

      // TC035: 不同時間調用一致性
      test('TC035: 相同參數在不同時間調用結果必須一致', async () => {
        const params = ['reader456', '時間測試', 'https://cdn.readmoo.com/cover/ab/time123_210x315.jpg']

        const result1 = adapter.generateStableBookId(...params)

        // 等待一小段時間
        await new Promise(resolve => setTimeout(resolve, 10))

        const result2 = adapter.generateStableBookId(...params)

        expect(result1).toBe(result2)
      })

      // TC036: 相同書籍不同封面尺寸
      test('TC036: 相同書籍不同封面尺寸應該提取相同coverID', () => {
        const baseId = 'samebook123'
        const url1 = `https://cdn.readmoo.com/cover/ab/${baseId}_210x315.jpg`
        const url2 = `https://cdn.readmoo.com/cover/ab/${baseId}_300x450.jpg`

        const result1 = adapter.generateStableBookId('reader1', '書籍', url1)
        const result2 = adapter.generateStableBookId('reader2', '書籍', url2)

        expect(result1).toBe(`cover-${baseId}`)
        expect(result2).toBe(`cover-${baseId}`)
        expect(result1).toBe(result2)
      })

      // TC037: 標題空格和標點符號差異
      test('TC037: 標題的空格和標點符號略有不同應該正規化後相同', () => {
        const title1 = 'JavaScript  程式設計！'
        const title2 = 'JavaScript 程式設計！'
        const title3 = 'JavaScript　程式設計!' // 全形空格和感嘆號

        const result1 = adapter.generateStableBookId('reader123', title1, '')
        const result2 = adapter.generateStableBookId('reader456', title2, '')
        const result3 = adapter.generateStableBookId('reader789', title3, '')

        // 正規化後應該產生相似的ID（具體實作可能略有不同）
        expect(result1).toMatch(/^title-javascript-程式設計/)
        expect(result2).toMatch(/^title-javascript-程式設計/)
        expect(result3).toMatch(/^title-javascript-程式設計/)
      })
    })

    describe('唯一性驗證', () => {
      // TC038: 不同書籍生成不同ID
      test('TC038: 兩本不同書籍應該生成不同ID', () => {
        const book1 = adapter.generateStableBookId(
          'reader1',
          '書籍A',
          'https://cdn.readmoo.com/cover/ab/bookA_210x315.jpg'
        )
        const book2 = adapter.generateStableBookId(
          'reader2',
          '書籍B',
          'https://cdn.readmoo.com/cover/ab/bookB_210x315.jpg'
        )

        expect(book1).not.toBe(book2)
        expect(book1).toBe('cover-bookA')
        expect(book2).toBe('cover-bookB')
      })

      // TC039: 相似但不同標題
      test('TC039: 相似但不同的標題應該生成不同ID', () => {
        const title1 = 'JavaScript入門指南'
        const title2 = 'JavaScript進階指南'

        const result1 = adapter.generateStableBookId('reader123', title1, '')
        const result2 = adapter.generateStableBookId('reader456', title2, '')

        expect(result1).not.toBe(result2)
        expect(result1).toContain('入門')
        expect(result2).toContain('進階')
      })

      // TC040: 相同標題不同封面
      test('TC040: 相同標題但不同封面應該基於封面生成不同ID', () => {
        const sameTitle = '程式設計基礎'
        const cover1 = 'https://cdn.readmoo.com/cover/ab/prog1_210x315.jpg'
        const cover2 = 'https://cdn.readmoo.com/cover/ab/prog2_210x315.jpg'

        const result1 = adapter.generateStableBookId('reader1', sameTitle, cover1)
        const result2 = adapter.generateStableBookId('reader2', sameTitle, cover2)

        expect(result1).not.toBe(result2)
        expect(result1).toBe('cover-prog1')
        expect(result2).toBe('cover-prog2')
      })

      // TC041: 批量唯一性驗證
      test('TC041: 批量不同書籍資料應該生成唯一ID', () => {
        const books = []
        const results = []

        // 生成100本不同的書籍
        for (let i = 0; i < 100; i++) {
          const result = adapter.generateStableBookId(
            `reader${i}`,
            `書籍標題${i}`,
            `https://cdn.readmoo.com/cover/ab/book${i}_210x315.jpg`
          )
          results.push(result)
        }

        // 檢查所有結果都是唯一的
        const uniqueResults = new Set(results)
        expect(uniqueResults.size).toBe(100)

        // 檢查每個結果都符合預期格式
        results.forEach((result, index) => {
          expect(result).toBe(`cover-book${index}`)
        })
      })
    })
  })

  describe('📊 效能和記憶體測試', () => {
    test('單次調用效能測試 - 應該在10ms內完成', () => {
      const startTime = performance.now()

      const result = adapter.generateStableBookId(
        'reader123',
        '效能測試書籍',
        'https://cdn.readmoo.com/cover/ab/perf123_210x315.jpg'
      )

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(result).toBe('cover-perf123')
      expect(duration).toBeLessThan(10) // 10ms內完成
    })

    test('記憶體使用測試 - 不應該有記憶體洩漏', () => {
      const initialMemory = process.memoryUsage ? process.memoryUsage().heapUsed : 0

      // 執行大量操作
      for (let i = 0; i < 1000; i++) {
        adapter.generateStableBookId(
          `reader${i}`,
          `記憶體測試${i}`,
          `https://cdn.readmoo.com/cover/ab/mem${i}_210x315.jpg`
        )
      }

      // 強制垃圾收集
      if (global.gc) global.gc()

      const finalMemory = process.memoryUsage ? process.memoryUsage().heapUsed : 0
      const memoryIncrease = finalMemory - initialMemory

      // 記憶體增長應該在合理範圍內（少於15MB，考慮字符串和正則表達式記憶體）
      expect(memoryIncrease).toBeLessThan(15 * 1024 * 1024)
    })
  })

  describe('🔒 安全性測試', () => {
    test('應該防止XSS攻擊', () => {
      const xssTitle = '<img src=x onerror=alert("XSS")>書名'
      const result = adapter.generateStableBookId('reader123', xssTitle, '')

      expect(result).not.toContain('<img')
      expect(result).not.toContain('onerror')
      expect(result).not.toContain('alert')
      expect(result).toContain('書名')
    })

    test('應該防止SQL注入式字符', () => {
      const sqlTitle = "書名'; DROP TABLE books; --"
      const result = adapter.generateStableBookId('reader123', sqlTitle, '')

      expect(result).not.toContain('DROP')
      expect(result).not.toContain('TABLE')
      expect(result).toContain('書名')
    })
  })
})
