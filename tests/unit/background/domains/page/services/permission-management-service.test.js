/**
 * PermissionManagementService 單元測試（page domain Permission Management bundle）
 *
 * 對應 docs/spec/page/domain-map.md 不變式：
 * 「必要權限（activeTab / scripting）缺失時回傳明確錯誤」
 *
 * 設計考量：原始碼並無「缺少必要權限時 throw Error」的實作，
 * 而是以 hasEssentialPermissions() / getMissingPermissions() 提供明確、
 * 可程式化判讀的缺失資訊供上層決策。測試對齊實際 API 行為。
 */

const PermissionManagementService = require('src/background/domains/page/services/permission-management-service')

function createSilentLogger () {
  return { log: jest.fn(), warn: jest.fn(), error: jest.fn() }
}

describe('PermissionManagementService', () => {
  let service

  beforeEach(() => {
    service = new PermissionManagementService({ logger: createSilentLogger() })
  })

  test('activeTab 與 scripting 皆未授予時，hasEssentialPermissions 回傳 false 且明確列出缺失項', () => {
    expect(service.hasEssentialPermissions()).toBe(false)

    const missing = service.getMissingPermissions()
    const missingKeys = missing.map(m => m.key)

    expect(missingKeys).toEqual(expect.arrayContaining(['activeTab', 'scripting']))

    const activeTabMissing = missing.find(m => m.key === 'activeTab')
    expect(activeTabMissing.config.description).toBeTruthy()
    expect(activeTabMissing.config.required).toBe(true)
  })

  test('僅補齊 activeTab 與 scripting 時，仍因 storage/readmoo_access 缺失回傳 false', () => {
    service.grantedPermissions.add('activeTab')
    service.grantedPermissions.add('scripting')

    expect(service.hasEssentialPermissions()).toBe(false)
    expect(service.getMissingPermissions().map(m => m.key)).not.toEqual(
      expect.arrayContaining(['activeTab', 'scripting'])
    )
  })

  test('全部必要（required）權限授予後，hasEssentialPermissions 回傳 true 且缺失清單不含必要權限', () => {
    ;['activeTab', 'scripting', 'storage', 'readmoo_access'].forEach(key => service.grantedPermissions.add(key))

    expect(service.hasEssentialPermissions()).toBe(true)
    const requiredMissing = service.getMissingPermissions().filter(m => m.config.required)
    expect(requiredMissing).toHaveLength(0)
  })
})
