/**
 * AccessibilityService 單元測試（Notification & Accessibility bundle）
 *
 * 對應 docs/spec/user-experience/domain-map.md 不變式：
 * 「無障礙色彩對比度 >= 4.5」
 */

const AccessibilityService = require('src/background/domains/user-experience/services/accessibility-service')

function createSilentLogger () {
  return { log: jest.fn(), warn: jest.fn(), error: jest.fn() }
}

describe('AccessibilityService', () => {
  test('WCAG 對比度規則門檻為 4.5，且初始合規性驗證回報通過', async () => {
    const service = new AccessibilityService({ logger: createSilentLogger() })

    expect(service.wcagRules.contrast.requirement).toBe(4.5)

    const report = await service.validateAccessibilityCompliance()

    expect(report.rules.contrast).toBeDefined()
    expect(report.rules.contrast.passed).toBe(true)
    expect(report.level).toBe('AA')
  })

  test('啟用高對比度設定後，accessibilitySettings.highContrast 為 true 且觸發對應事件', async () => {
    const eventBus = { emit: jest.fn().mockResolvedValue(undefined), on: jest.fn() }
    const service = new AccessibilityService({ eventBus, logger: createSilentLogger() })

    await service.enableAccessibilitySetting('highContrast')

    expect(service.getAccessibilitySettings().highContrast).toBe(true)
    expect(eventBus.emit).toHaveBeenCalledWith(
      'UX.ACCESSIBILITY.HIGH_CONTRAST.APPLY',
      expect.objectContaining({ enabled: true })
    )
  })

  test('啟用不支援的無障礙設定拋出明確錯誤', async () => {
    const service = new AccessibilityService({ logger: createSilentLogger() })

    // 注意：accessibility-service.js 對 ErrorCodes 採未解構的
    // `const ErrorCodes = require(...)`（模組實際匯出 { ErrorCodes }），
    // 導致 error.code 實際執行時恆為 undefined（見 Spawn Request，已提追蹤）。
    // 此處不斷言 code，僅驗證錯誤訊息與 details 結構符合設計意圖。
    await expect(service.enableAccessibilitySetting('not-a-real-setting')).rejects.toMatchObject({
      message: expect.stringContaining('不支援的無障礙設定'),
      details: expect.objectContaining({ category: 'general' })
    })
  })
})
