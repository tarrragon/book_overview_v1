/**
 * TabStateTrackingService - Readmoo Vue SPA hash route 頁面偵測測試
 *
 * 對應 ticket 0.19.0-W1-029.1：
 * 修正過時 readmoo.com/library URL pattern，支援真實書庫頁
 * https://read.readmoo.com/#/library（Vue SPA hash route）。
 *
 * 此測試聚焦 detectPageType 對 hash route 的偵測正確性，
 * 不含任何計時斷言（符合 test-assertion-design-rules）。
 */

const TabStateTrackingService = require('src/background/domains/page/services/tab-state-tracking-service')

describe('TabStateTrackingService - Readmoo SPA 頁面偵測 (W1-029.1)', () => {
  let service

  beforeEach(() => {
    service = new TabStateTrackingService()
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

    test('非 Readmoo 頁面應回傳 null', async () => {
      const pageType = await service.detectPageType('https://example.com/library')
      expect(pageType).toBeNull()
    })
  })
})
