/**
 * PlatformSwitcherService 單元測試（Platform Switcher bundle）
 *
 * 對應 docs/spec/platform/domain-map.md 不變式：
 * 「切換至已註冊平台成功；切換至未註冊平台失敗」
 */

const PlatformSwitcherService = require('src/background/domains/platform/services/platform-switcher-service')

function createEventBusMock () {
  return {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn().mockResolvedValue(undefined)
  }
}

function createRegistryMock (platforms = {}) {
  const adapterCache = new Map()
  return {
    getPlatform: jest.fn((id) => platforms[id] || null),
    getActivePlatforms: jest.fn(() =>
      Object.entries(platforms)
        .filter(([, config]) => config.status === 'active')
        .map(([platformId]) => ({ platformId }))
    ),
    getAdapterCache: jest.fn((id) => adapterCache.get(id) || null),
    setAdapterCache: jest.fn((id, adapter) => adapterCache.set(id, adapter)),
    platformSupportsCapability: jest.fn(() => true)
  }
}

function createSilentLogger () {
  return { info: jest.fn(), error: jest.fn() }
}

describe('PlatformSwitcherService', () => {
  let eventBus
  let registry
  let adapterFactory
  let service

  beforeEach(() => {
    eventBus = createEventBusMock()
    registry = createRegistryMock({
      kobo: { status: 'active' }
    })
    adapterFactory = { createAdapter: jest.fn() }
    service = new PlatformSwitcherService(eventBus, {
      registry,
      adapterFactory,
      logger: createSilentLogger()
    })
    // 停用自動故障轉移：本測試套件聚焦 switchToPlatform 本身的驗證與成功路徑，
    // 非 attemptFallback 行為。保留 autoFallback 預設值會在驗證失敗測試情境下
    // 觸發 attemptFallback 反覆重試同一個（永遠失敗的）目標平台，造成無窮遞迴。
    service.switchConfig.autoFallback = false
  })

  test('切換至已註冊且狀態為 active 的平台成功', async () => {
    const adapter = {
      activate: jest.fn().mockResolvedValue(undefined),
      healthCheck: jest.fn().mockResolvedValue({ healthy: true })
    }
    adapterFactory.createAdapter.mockResolvedValue(adapter)

    const result = await service.switchToPlatform('kobo')

    expect(result.success).toBe(true)
    expect(service.getCurrentPlatform()).toBe('kobo')
  })

  test('切換至未註冊平台失敗，並保持當前平台不變', async () => {
    const result = await service.switchToPlatform('unregistered-platform')

    expect(result.success).toBe(false)
    expect(result.error).toContain('未註冊')
    expect(service.getCurrentPlatform()).toBeNull()
  })

  test('切換至已註冊但非 active 狀態的平台失敗', async () => {
    registry.getPlatform.mockReturnValue({ status: 'inactive' })

    const result = await service.switchToPlatform('kobo')

    expect(result.success).toBe(false)
    expect(result.error).toContain('狀態為')
  })
})
