/**
 * ContentScriptCoordinatorService - Readmoo Vue SPA hash route 偵測與分頁處理測試
 *
 * 對應 ticket 0.19.0-W1-029.1：
 * 修正過時 readmoo.com/library URL pattern 與 content script 注入判斷，
 * 支援真實書庫頁 https://read.readmoo.com/#/library（Vue SPA hash route）。
 *
 * 涵蓋兩個過時引用：
 * - detectPageType 的 url.includes('readmoo.com/library') 子字串偵測
 * - readmoo_library_extractor 腳本的 matches 比對（經 shouldProcessTab）
 *
 * 不含任何計時斷言（符合 test-assertion-design-rules）。
 */

const ContentScriptCoordinatorService = require('src/background/domains/page/services/content-script-coordinator-service')

describe('ContentScriptCoordinatorService - Readmoo SPA 偵測 (W1-029.1)', () => {
  let service

  beforeEach(() => {
    service = new ContentScriptCoordinatorService()
    service.initializeScriptConfigs()
  })

  describe('detectPageType - read.readmoo.com hash route', () => {
    test('應將 https://read.readmoo.com/#/library 偵測為 readmoo_library', async () => {
      const pageType = await service.detectPageType('https://read.readmoo.com/#/library')
      expect(pageType).toBe('readmoo_library')
    })

    test('應將舊版 https://member.readmoo.com/library 仍偵測為 readmoo_library', async () => {
      const pageType = await service.detectPageType('https://member.readmoo.com/library')
      expect(pageType).toBe('readmoo_library')
    })

    test('非書庫的 Readmoo 頁面應偵測為 readmoo_main', async () => {
      const pageType = await service.detectPageType('https://readmoo.com/')
      expect(pageType).toBe('readmoo_main')
    })
  })

  describe('shouldProcessTab - readmoo_library_extractor match pattern', () => {
    test('應處理真實書庫頁 https://read.readmoo.com/#/library', () => {
      expect(service.shouldProcessTab('https://read.readmoo.com/#/library')).toBe(true)
    })

    test('應處理 read.readmoo.com 子域名其他路徑', () => {
      expect(service.shouldProcessTab('https://read.readmoo.com/')).toBe(true)
    })

    test('非 Readmoo 頁面不應被處理', () => {
      expect(service.shouldProcessTab('https://example.com/library')).toBe(false)
    })
  })
})
