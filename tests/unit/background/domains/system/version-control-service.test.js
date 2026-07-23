/**
 * @fileoverview Version Control Service 單元測試
 *
 * 對應 domain-map 不變式：版本比較遵循 semver；升級從低到高單調；降級被拒。
 *
 * 「降級被拒」在本實作對應 isVersionCompatible：當目前版本低於需求版本時，
 * 視為不相容（回傳 false），等同拒絕在低於需求版本的環境下繼續運作。
 */

const VersionControlService = require('src/background/domains/system/services/version-control-service.js')

describe('VersionControlService', () => {
  let service
  let mockLogger
  let mockEventBus

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    }
    mockEventBus = {
      emit: jest.fn().mockResolvedValue(true),
      on: jest.fn().mockResolvedValue('listener-id'),
      off: jest.fn().mockResolvedValue(true)
    }

    service = new VersionControlService({ logger: mockLogger, eventBus: mockEventBus })
  })

  describe('版本比較遵循 semver', () => {
    test('主版本號較大時應回傳 1', () => {
      expect(service.compareVersions('2.0.0', '1.9.9')).toBe(1)
    })

    test('次版本號較大時應回傳 1', () => {
      expect(service.compareVersions('1.2.0', '1.1.9')).toBe(1)
    })

    test('修訂版本號較大時應回傳 1', () => {
      expect(service.compareVersions('1.0.2', '1.0.1')).toBe(1)
    })

    test('版本相同時應回傳 0', () => {
      expect(service.compareVersions('1.0.0', '1.0.0')).toBe(0)
    })

    test('版本較低時應回傳 -1', () => {
      expect(service.compareVersions('1.0.0', '1.0.1')).toBe(-1)
    })
  })

  describe('升級從低到高單調', () => {
    test('版本序列由低到高排列時，相鄰版本比較皆呈現遞增關係', () => {
      const versions = ['0.9.0', '1.0.0', '1.0.1', '1.1.0', '2.0.0']

      for (let i = 0; i < versions.length - 1; i++) {
        expect(service.compareVersions(versions[i], versions[i + 1])).toBe(-1)
        expect(service.compareVersions(versions[i + 1], versions[i])).toBe(1)
      }
    })
  })

  describe('降級被拒', () => {
    test('目前版本低於需求版本時，應視為不相容', () => {
      expect(service.isVersionCompatible('2.0.0', '1.9.0')).toBe(false)
    })

    test('目前版本等於需求版本時，應視為相容', () => {
      expect(service.isVersionCompatible('1.0.0', '1.0.0')).toBe(true)
    })

    test('目前版本高於需求版本時，應視為相容', () => {
      expect(service.isVersionCompatible('1.0.0', '2.0.0')).toBe(true)
    })
  })
})
