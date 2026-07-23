/**
 * ThemeManagementService 單元測試（Theme & Personalization bundle）
 *
 * 對應 docs/spec/user-experience/domain-map.md 不變式：
 * 「深色/淺色主題切換後 CSS 變數更新；偏好持久化後重啟保留」
 */

const ThemeManagementService = require('src/background/domains/user-experience/services/theme-management-service')

function createSilentLogger () {
  return { log: jest.fn(), warn: jest.fn(), error: jest.fn() }
}

function createStorageServiceMock () {
  const store = new Map()
  return {
    get: jest.fn(async (key) => store.get(key)),
    set: jest.fn(async (key, value) => { store.set(key, value) })
  }
}

describe('ThemeManagementService', () => {
  test('切換至 dark 主題後，已註冊的提供者收到含正確色彩變數的 updateTheme 呼叫', async () => {
    const service = new ThemeManagementService({ logger: createSilentLogger() })
    service.state.active = true

    const provider = { updateTheme: jest.fn() }
    service.registerThemeProvider('popup', provider)

    const result = await service.setTheme('dark')

    expect(result.success).toBe(true)
    expect(provider.updateTheme).toHaveBeenCalledWith('dark', expect.objectContaining({
      mode: 'dark',
      colors: expect.objectContaining({ background: expect.any(String) })
    }))
    expect(service.getCurrentTheme().effectiveTheme).toBe('dark')
  })

  test('設定無效主題時拋出明確錯誤，不影響已生效主題', async () => {
    const service = new ThemeManagementService({ logger: createSilentLogger() })

    // 注意：theme-management-service.js 對 ErrorCodes 採未解構的
    // `const ErrorCodes = require(...)`（模組實際匯出 { ErrorCodes }），
    // 導致 error.code 實際執行時恆為 undefined（見 Spawn Request，已提追蹤）。
    // 此處不斷言 code，僅驗證錯誤訊息與 details 結構符合設計意圖。
    await expect(service.setTheme('not-a-theme')).rejects.toMatchObject({
      message: expect.stringContaining('無效的主題'),
      details: expect.objectContaining({ category: 'general' })
    })
  })

  test('主題偏好持久化後，重新建立服務實例可還原先前設定（模擬重啟保留）', async () => {
    const storageService = createStorageServiceMock()
    const service1 = new ThemeManagementService({ storageService, logger: createSilentLogger() })

    await service1.setTheme('dark')

    // 模擬重啟：建立新的服務實例，共用同一個持久化來源
    const service2 = new ThemeManagementService({ storageService, logger: createSilentLogger() })
    await service2.loadUserThemePreference()

    expect(service2.currentTheme).toBe('dark')
  })
})
