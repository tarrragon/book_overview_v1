/**
 * validate-token-manifest.js 單元測試
 *
 * 涵蓋 1.5.0-W6-008 acceptance 1「正反兩向漂移必紅燈」：
 *   - 正向漂移：manifest 記載的 V1 token 值與 V1 原始檔不符 → 紅燈
 *   - 正向缺失：manifest 記載的 path 在 V1 原始檔中不存在 → 紅燈
 *   - 反向漂移：V1 原始檔新增了 manifest 未記載的常數 → 紅燈
 *   - 一致狀態：manifest 與 V1 完全對齊 → 綠燈（0 errors）
 *
 * 設計原則（比照 tests/unit/scripts/validate-manifest.test.js）：
 * - 純函式優先，validateBidirectional 接收 (manifestTokens, v1TokenMap) 兩個資料結構，
 *   不做 I/O，測試以 fixture 資料結構直接驗證核心邏輯，不需 subprocess。
 * - loadV1TokenPaths 為唯一 I/O 函式，另以暫存 fixture 檔驗證其 require() 載入與攤平邏輯。
 */

const fs = require('fs')
const os = require('os')
const path = require('path')

const {
  deepEqual,
  flattenExports,
  loadV1TokenPaths,
  collectManifestTokens,
  validateBidirectional
} = require('../../../scripts/validate-token-manifest')

describe('validate-token-manifest', () => {
  describe('deepEqual', () => {
    it('primitive 相同值應回傳 true', () => {
      expect(deepEqual('rgba(0, 0, 0, 0.1)', 'rgba(0, 0, 0, 0.1)')).toBe(true)
      expect(deepEqual(24, 24)).toBe(true)
    })

    it('primitive 不同值應回傳 false', () => {
      expect(deepEqual('rgba(0,0,0,0.1)', 'rgba(0, 0, 0, 0.1)')).toBe(false)
      expect(deepEqual(24, 25)).toBe(false)
    })

    it('巢狀物件（如 STATUS_COLORS.unread 的 { fg, bg }）相同時應回傳 true', () => {
      expect(deepEqual({ fg: '#546E7A', bg: '#ECEFF1' }, { fg: '#546E7A', bg: '#ECEFF1' })).toBe(true)
    })

    it('巢狀物件某鍵值不同時應回傳 false', () => {
      expect(deepEqual({ fg: '#546E7A', bg: '#ECEFF1' }, { fg: '#000000', bg: '#ECEFF1' })).toBe(false)
    })

    it('物件鍵數不同時應回傳 false', () => {
      expect(deepEqual({ fg: '#546E7A', bg: '#ECEFF1' }, { fg: '#546E7A' })).toBe(false)
    })
  })

  describe('flattenExports', () => {
    it('primitive 匯出應以匯出名本身作為 path（不含點號）', () => {
      const flattened = flattenExports({ FONT_FAMILY: 'PingFang SC' })
      expect(flattened.get('FONT_FAMILY')).toBe('PingFang SC')
    })

    it('物件匯出應展開為「匯出名.鍵」', () => {
      const flattened = flattenExports({ COLORS: { primary: '#1A56DB', success: '#2E8B57' } })
      expect(flattened.get('COLORS.primary')).toBe('#1A56DB')
      expect(flattened.get('COLORS.success')).toBe('#2E8B57')
      expect(flattened.size).toBe(2)
    })

    it('巢狀物件值（如 { fg, bg }）應視為單一 token 值，不再往下展開', () => {
      const flattened = flattenExports({
        STATUS_COLORS: { unread: { fg: '#546E7A', bg: '#ECEFF1' } }
      })
      expect(flattened.get('STATUS_COLORS.unread')).toEqual({ fg: '#546E7A', bg: '#ECEFF1' })
      expect(flattened.has('STATUS_COLORS.unread.fg')).toBe(false)
    })
  })

  describe('loadV1TokenPaths（I/O：require() 載入 fixture 檔）', () => {
    let tmpDir

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-token-manifest-test-'))
    })

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('應以 require() 載入 fixture token 檔並附帶 sourceFile', () => {
      const fixtureFile = path.join(tmpDir, 'fixture-tokens.js')
      fs.writeFileSync(
        fixtureFile,
        "const COLORS = { primary: '#1A56DB' }\nmodule.exports = { COLORS, FONT_FAMILY: 'PingFang SC' }\n"
      )

      const tokenMap = loadV1TokenPaths({ rootDir: tmpDir, sourceFiles: ['fixture-tokens.js'] })

      expect(tokenMap.get('COLORS.primary')).toEqual({ value: '#1A56DB', sourceFile: 'fixture-tokens.js' })
      expect(tokenMap.get('FONT_FAMILY')).toEqual({ value: 'PingFang SC', sourceFile: 'fixture-tokens.js' })
    })
  })

  describe('collectManifestTokens', () => {
    it('應窮舉直接 { tokens: [...] } 型態（如 domains.colors）', () => {
      const domains = {
        colors: { tokens: [{ key: 'primary', category: 'calibrated' }] }
      }
      const tokens = collectManifestTokens(domains)
      expect(tokens).toEqual([{ key: 'primary', category: 'calibrated', domainPath: 'colors' }])
    })

    it('應窮舉巢狀子群組型態（如 domains.typography.fontSizes）', () => {
      const domains = {
        typography: {
          fontSizes: { tokens: [{ key: 'headline3', category: 'shared' }] },
          fontWeights: { tokens: [{ key: 'bold', category: 'shared' }] }
        }
      }
      const tokens = collectManifestTokens(domains)
      expect(tokens).toEqual(
        expect.arrayContaining([
          { key: 'headline3', category: 'shared', domainPath: 'typography.fontSizes' },
          { key: 'bold', category: 'shared', domainPath: 'typography.fontWeights' }
        ])
      )
      expect(tokens).toHaveLength(2)
    })

    it('應窮舉 appOnlyDomains 三層巢狀型態', () => {
      const domains = {
        appOnlyDomains: {
          description: '純文字節點應被略過',
          animations: { sourceFile: 'lib/x.dart', tokens: [{ key: 'fast', category: 'platformOnlyApp' }] }
        }
      }
      const tokens = collectManifestTokens(domains)
      expect(tokens).toEqual([
        { key: 'fast', category: 'platformOnlyApp', domainPath: 'appOnlyDomains.animations' }
      ])
    })

    it('陣列型欄位（如 excludedResponsiveFunctions）不應被誤判為可遞迴節點', () => {
      const domains = {
        componentSizes: {
          excludedResponsiveFunctions: ['appBar(context)'],
          tokens: [{ key: 'buttonSmall', category: 'platformOnlyApp' }]
        }
      }
      const tokens = collectManifestTokens(domains)
      expect(tokens).toEqual([
        { key: 'buttonSmall', category: 'platformOnlyApp', domainPath: 'componentSizes' }
      ])
    })
  })

  describe('validateBidirectional：正反兩向漂移必紅燈（acceptance 1）', () => {
    function makeManifestToken (key, v1Path, v1Value, domainPath = 'colors') {
      return {
        key,
        category: 'shared',
        domainPath,
        platforms: { v1: { path: v1Path, value: v1Value }, app: null }
      }
    }

    it('golden path：manifest 與 V1 完全一致時應 0 errors', () => {
      const manifestTokens = [makeManifestToken('primary', 'COLORS.primary', '#1A56DB')]
      const v1TokenMap = new Map([['COLORS.primary', { value: '#1A56DB', sourceFile: 'colors.js' }]])

      const result = validateBidirectional(manifestTokens, v1TokenMap)

      expect(result.errors).toEqual([])
      expect(result.forwardChecked).toBe(1)
      expect(result.reverseChecked).toBe(1)
    })

    it('正向漂移：manifest 記載值與 V1 實際值不符時應紅燈（W6-007 實測案例：rgba 空格差異）', () => {
      const manifestTokens = [makeManifestToken('sm', 'SHADOW_COLORS.sm', 'rgba(0,0,0,0.1)', 'shadowColors')]
      const v1TokenMap = new Map([
        ['SHADOW_COLORS.sm', { value: 'rgba(0, 0, 0, 0.1)', sourceFile: 'shadows.js' }]
      ])

      const result = validateBidirectional(manifestTokens, v1TokenMap)

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('正向不符')
      expect(result.errors[0]).toContain('SHADOW_COLORS.sm')
      expect(result.errors[0]).toContain('修復指令')
    })

    it('正向缺失：manifest 記載的 path 在 V1 原始檔中不存在時應紅燈', () => {
      const manifestTokens = [
        makeManifestToken('primary', 'COLORS.primary', '#1A56DB'),
        makeManifestToken('removed', 'COLORS.removed', '#000000')
      ]
      const v1TokenMap = new Map([['COLORS.primary', { value: '#1A56DB', sourceFile: 'colors.js' }]])

      const result = validateBidirectional(manifestTokens, v1TokenMap)

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('正向缺失')
      expect(result.errors[0]).toContain('COLORS.removed')
      expect(result.errors[0]).toContain('修復指令')
    })

    it('反向漂移：V1 新增 manifest 未記載的常數時應紅燈', () => {
      const manifestTokens = [makeManifestToken('primary', 'COLORS.primary', '#1A56DB')]
      const v1TokenMap = new Map([
        ['COLORS.primary', { value: '#1A56DB', sourceFile: 'colors.js' }],
        ['COLORS.newToken', { value: '#FFFFFF', sourceFile: 'colors.js' }]
      ])

      const result = validateBidirectional(manifestTokens, v1TokenMap)

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('反向缺失')
      expect(result.errors[0]).toContain('COLORS.newToken')
      expect(result.errors[0]).toContain('修復指令')
    })

    it('應同時偵測正向與反向兩種漂移（同批多項不符）', () => {
      const manifestTokens = [
        makeManifestToken('primary', 'COLORS.primary', '#WRONG'),
        makeManifestToken('missing', 'COLORS.missingInV1', '#000000')
      ]
      const v1TokenMap = new Map([
        ['COLORS.primary', { value: '#1A56DB', sourceFile: 'colors.js' }],
        ['COLORS.undocumented', { value: '#123456', sourceFile: 'colors.js' }]
      ])

      const result = validateBidirectional(manifestTokens, v1TokenMap)

      expect(result.errors.some((e) => e.includes('正向不符'))).toBe(true)
      expect(result.errors.some((e) => e.includes('正向缺失'))).toBe(true)
      expect(result.errors.some((e) => e.includes('反向缺失'))).toBe(true)
      expect(result.forwardChecked).toBe(2)
      expect(result.reverseChecked).toBe(2)
    })

    it('platforms.v1 為 null 的 token（platformOnlyApp）不參與正向查核', () => {
      const manifestTokens = [
        { key: 'onPrimary', category: 'platformOnlyApp', domainPath: 'colors', platforms: { v1: null, app: { path: 'UIColors.onPrimary', value: '#FFFFFF' } } }
      ]
      const v1TokenMap = new Map()

      const result = validateBidirectional(manifestTokens, v1TokenMap)

      expect(result.errors).toEqual([])
      expect(result.forwardChecked).toBe(0)
      expect(result.reverseChecked).toBe(0)
    })
  })

  describe('真實資料一致性（sanity check：現行 manifest 與 V1 原始檔應 0 漂移）', () => {
    it('token-manifest.json 與 4 個 V1 token 檔應通過雙向校驗', () => {
      const manifestPath = path.join(__dirname, '../../../src/core/design-system/token-manifest.json')
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      const manifestTokens = collectManifestTokens(manifest.domains)
      const v1TokenMap = loadV1TokenPaths()

      const result = validateBidirectional(manifestTokens, v1TokenMap)

      expect(result.errors).toEqual([])
    })
  })
})
