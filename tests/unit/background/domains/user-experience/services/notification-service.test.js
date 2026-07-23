/**
 * NotificationService 單元測試（Notification & Accessibility bundle）
 *
 * 對應 docs/spec/user-experience/domain-map.md 不變式：
 * 「通知顯示後可手動關閉」
 */

const NotificationService = require('src/background/domains/user-experience/services/notification-service')

function createSilentLogger () {
  return { log: jest.fn(), warn: jest.fn(), error: jest.fn() }
}

describe('NotificationService', () => {
  test('通知顯示後可透過 clearNotification 手動關閉', async () => {
    const service = new NotificationService({ logger: createSilentLogger() })

    const showResult = await service.showNotification({ type: 'info', title: '標題', message: '內容' })

    expect(showResult.shown).toBe(true)
    expect(service.activeNotifications.size).toBe(1)

    const clearResult = await service.clearNotification(showResult.id)

    expect(clearResult.cleared).toBe(true)
    expect(service.activeNotifications.has(showResult.id)).toBe(false)
  })

  test('清除不存在的通知回傳 cleared:false 且附帶原因', async () => {
    const service = new NotificationService({ logger: createSilentLogger() })

    const result = await service.clearNotification('non-existent-id')

    expect(result.cleared).toBe(false)
    expect(result.reason).toBe('not_found')
  })

  test('缺少 title 與 message 的通知會被拒絕顯示', async () => {
    const service = new NotificationService({ logger: createSilentLogger() })

    const result = await service.showNotification({ type: 'info' })

    expect(result.shown).toBe(false)
    expect(result.reason).toBe('error')
  })
})
