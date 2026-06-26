/**
 * @fileoverview Platform Registry 測試
 * @version v1.0.0
 * @since 2026-06-26
 *
 * 測試目標：
 * - detect(url) 對 Readmoo URL 的成功偵測與非書城 URL 的失敗回傳
 * - getAllMatchPatterns() 回傳所有書城 match patterns
 * - getRegisteredPlatforms() 回傳已註冊書城配置
 * - detect 回傳的 createAdapter 能建構出 Readmoo 適配器
 */

describe('PlatformRegistry', () => {
  let PlatformRegistry

  beforeAll(() => {
    PlatformRegistry = require('src/content/platform/platform-registry.js')
  })

  describe('detect(url)', () => {
    test('應該識別書庫頁 URL 並回傳 Readmoo 配置與 createAdapter', () => {
      const result = PlatformRegistry.detect('https://read.readmoo.com/#/library')

      expect(result).not.toBeNull()
      expect(result.config.name).toBe('readmoo')
      expect(typeof result.createAdapter).toBe('function')
    })

    test('應該識別 member 子網域 URL', () => {
      const result = PlatformRegistry.detect('https://member.readmoo.com/')

      expect(result).not.toBeNull()
      expect(result.config.name).toBe('readmoo')
    })

    test('應該識別根網域 readmoo.com', () => {
      const result = PlatformRegistry.detect('https://readmoo.com/')

      expect(result).not.toBeNull()
      expect(result.config.name).toBe('readmoo')
    })

    test('createAdapter 應該建構出可用的適配器物件', () => {
      const result = PlatformRegistry.detect('https://read.readmoo.com/#/library')
      const adapter = result.createAdapter()

      expect(adapter).toBeDefined()
      expect(adapter).not.toBeNull()
    })

    test('非書城 URL 應該回傳 null', () => {
      expect(PlatformRegistry.detect('https://www.google.com/')).toBeNull()
    })

    test('相似但非書城的 hostname 不應誤命中（後綴邊界）', () => {
      expect(PlatformRegistry.detect('https://evilreadmoo.com/')).toBeNull()
    })

    test('無效 URL 應該回傳 null 而非拋錯', () => {
      expect(PlatformRegistry.detect('not-a-url')).toBeNull()
      expect(PlatformRegistry.detect('')).toBeNull()
    })
  })

  describe('getAllMatchPatterns()', () => {
    test('應該回傳包含 Readmoo match pattern 的陣列', () => {
      const patterns = PlatformRegistry.getAllMatchPatterns()

      expect(Array.isArray(patterns)).toBe(true)
      expect(patterns).toContain('*://*.readmoo.com/*')
    })

    test('回傳的 match patterns 不應有重複', () => {
      const patterns = PlatformRegistry.getAllMatchPatterns()

      expect(patterns.length).toBe(new Set(patterns).size)
    })
  })

  describe('getRegisteredPlatforms()', () => {
    test('應該回傳已註冊書城配置清單', () => {
      const platforms = PlatformRegistry.getRegisteredPlatforms()

      expect(Array.isArray(platforms)).toBe(true)
      expect(platforms.length).toBeGreaterThanOrEqual(1)
      expect(platforms.map((p) => p.name)).toContain('readmoo')
    })

    test('每筆配置應含必要欄位', () => {
      const platforms = PlatformRegistry.getRegisteredPlatforms()

      platforms.forEach((config) => {
        expect(typeof config.name).toBe('string')
        expect(typeof config.displayName).toBe('string')
        expect(Array.isArray(config.matchPatterns)).toBe(true)
        expect(Array.isArray(config.hostnames)).toBe(true)
        expect(typeof config.adapterFactory).toBe('function')
        expect(typeof config.libraryUrl).toBe('string')
      })
    })

    test('回傳的應為副本，修改不影響內部狀態', () => {
      const first = PlatformRegistry.getRegisteredPlatforms()
      first.push({ name: 'fake' })
      const second = PlatformRegistry.getRegisteredPlatforms()

      expect(second.map((p) => p.name)).not.toContain('fake')
    })
  })
})
