/**
 * NavigationService 單元測試（page domain Navigation bundle）
 *
 * 對應 docs/spec/page/domain-map.md 不變式：
 * 「URL 變更偵測不漏（含 SPA hash 變更）；MutationObserver 正確清理」
 *
 * 設計考量：實際 SPA hash 路由變更偵測與清理邏輯落於本檔的
 * chrome.webNavigation 事件監聽器（onHistoryStateUpdated 等）與
 * webNavigationListeners Map，而非 MutationObserver（該實作位於
 * src/content/detectors/page-detector.js，屬 Page Detection bundle）。
 * 測試改以本檔實際 API 驗證同等語意：URL 變更事件不漏接、監聽器可正確清理。
 */

const NavigationService = require('src/background/domains/page/services/navigation-service')

function createSilentLogger () {
  return { log: jest.fn(), warn: jest.fn(), error: jest.fn() }
}

describe('NavigationService', () => {
  let service

  beforeEach(() => {
    jest.clearAllMocks()
    service = new NavigationService({ logger: createSilentLogger() })
    service.state.tracking = true
  })

  describe('URL 變更偵測（含 SPA hash 變更）', () => {
    test('history state 更新（SPA hash 變更）應記錄為新的導航歷史', async () => {
      const details = { tabId: 1, url: 'https://readmoo.com/#/library', frameId: 0, timeStamp: 1000, transitionType: 'link' }

      await service.handleHistoryStateUpdated(details)

      const history = service.getNavigationHistory(1)
      expect(history).toHaveLength(1)
      expect(history[0].status).toBe('history_updated')
      expect(history[0].url).toBe('https://readmoo.com/#/library')
    })

    test('非 readmoo.com 網域不追蹤，不寫入導航歷史', async () => {
      const details = { tabId: 2, url: 'https://example.com/#/other', frameId: 0, timeStamp: 2000 }

      await service.handleHistoryStateUpdated(details)

      expect(service.getNavigationHistory(2)).toHaveLength(0)
    })

    test('導航提交事件更新目前導航狀態，反映 URL 變更已提交', async () => {
      service.currentNavigations.set(3, { status: 'started', route: null })
      const details = { tabId: 3, url: 'https://readmoo.com/library', frameId: 0, timeStamp: 3000, transitionType: 'reload' }

      await service.handleNavigationCommitted(details)

      const currentNav = service.getCurrentNavigation(3)
      expect(currentNav.status).toBe('committed')
      expect(currentNav.transitionType).toBe('reload')
    })
  })

  describe('監聽器清理', () => {
    test('stop() 應清除所有已註冊的 Web Navigation 監聽器', async () => {
      await service.initialize()
      await service.start()

      expect(service.webNavigationListeners.size).toBeGreaterThan(0)

      await service.stop()

      expect(service.webNavigationListeners.size).toBe(0)
    })
  })
})
