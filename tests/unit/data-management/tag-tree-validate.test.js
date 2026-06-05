/**
 * Tag 樹狀 model 驗證測試（場景組 A-V + B-validate：unit）
 *
 * 涵蓋範圍：
 * - validateTagCategory(category, siblingCategories) scoped 兄弟唯一鍵（SPEC-010 §2.3）
 * - 兄弟同鍵衝突 / 不同 parent 同名通過
 * - parentId 型別檢查（string|null）
 * - validateTagCategory 不殘留全域 name 比對（場景 A3-3）
 *
 * TDD Phase 2（Red）：基於 SPEC-010 §3 場景組 A/B 撰寫，實作由 Phase 3 完成。
 * 對應 Ticket: 0.20.0-W2-007
 *
 * 設計考量：無計時硬門檻；純函式正確性驗證。
 */

const TagSchema = require('src/data-management/TagSchema')

const validateTagCategory = TagSchema.validateTagCategory

describe('validateTagCategory - scoped 兄弟唯一鍵（場景組 A-V）', () => {
  describe('A-V1: 兄弟集合內同鍵衝突', () => {
    it('同 parentId 同 name 在兄弟集合中衝突 → valid=false', () => {
      const siblings = [
        { id: 'c1', name: '00 特藏', parentId: 'sys_cat_0' }
      ]
      const candidate = { id: 'c2', name: '00 特藏', parentId: 'sys_cat_0' }
      const result = validateTagCategory(candidate, siblings)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('A-V2: 不同 parent 同名通過', () => {
    it('siblings 為同 parent 集合（不含跨 parent 節點）時同名 valid=true', () => {
      // 兄弟集合僅含同 parentId 的節點；跨 parent 同名節點不在此集合內
      const siblings = []
      const candidate = { id: 'c2', name: '總論', parentId: 'cat_phil' }
      const result = validateTagCategory(candidate, siblings)
      expect(result.valid).toBe(true)
    })
  })

  describe('A3-3: validateTagCategory 不殘留全域 name 比對', () => {
    it('全域有同名但不同 parent（不在 sibling 集合）→ valid=true', () => {
      // 若殘留全域比對，此處會被誤擋
      const siblings = []
      const candidate = { id: 'c9', name: '總論', parentId: 'cat_other' }
      const result = validateTagCategory(candidate, siblings)
      expect(result.valid).toBe(true)
    })
  })
})

describe('validateTagCategory - parentId 防護（場景 B-validate）', () => {
  describe('B-validate: parentId 型別檢查', () => {
    it('parentId 為數字（非 string|null）→ valid=false', () => {
      const candidate = { id: 'c1', name: 'x', parentId: 123 }
      const result = validateTagCategory(candidate, [])
      expect(result.valid).toBe(false)
    })

    it('parentId 為 null（根節點）→ 型別通過', () => {
      const candidate = { id: 'c1', name: 'root-cat', parentId: null }
      const result = validateTagCategory(candidate, [])
      // null parentId 合法（根節點）；其餘欄位假設有效
      expect(result.valid).toBe(true)
    })

    it('parentId 為 string → 型別通過', () => {
      const candidate = { id: 'c1', name: 'child-cat', parentId: 'sys_cat_0' }
      const result = validateTagCategory(candidate, [])
      expect(result.valid).toBe(true)
    })
  })
})
