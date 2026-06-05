/**
 * Tag 樹狀 model 唯一鍵生成測試（場景組 A：unit）
 *
 * 涵蓋範圍：
 * - makeCategoryKey(parentId, name) scoped 唯一鍵語意（SPEC-010 §2.2）
 * - 跨 parent 同名不衝突 / 同 parent 同名衝突
 * - null parentId 用 'ROOT' sentinel
 *
 * TDD Phase 2（Red）：基於 SPEC-010 §3 場景組 A 撰寫，實作由 Phase 3 完成。
 * 對應 Ticket: 0.20.0-W2-007
 *
 * 設計考量（test-assertion-design 規則）：無計時硬門檻；純函式正確性驗證。
 */

const TagSchema = require('src/data-management/TagSchema')

// makeCategoryKey 為 Phase 3 待實作；Red 階段可能為 undefined → 斷言失敗（符合 TDD Red）
const makeCategoryKey = TagSchema.makeCategoryKey

describe('makeCategoryKey - scoped 唯一鍵語意（場景組 A）', () => {
  describe('A-U1: 跨 parent 同名不相等', () => {
    it('不同 parentId 下同名 name 生成不同鍵', () => {
      const keyRoot = makeCategoryKey(null, '總論')
      const keyPhil = makeCategoryKey('cat_phil', '總論')
      expect(keyRoot).not.toBe(keyPhil)
    })
  })

  describe('A-U2: 大小寫正規化', () => {
    it('同 parentId 同 name（大小寫不同）生成相同鍵', () => {
      const keyLower = makeCategoryKey('cat_0', 'Special')
      const keyUpper = makeCategoryKey('cat_0', 'SPECIAL')
      expect(keyLower).toBe(keyUpper)
    })

    it('同 parentId 同 name 生成相同鍵（中文）', () => {
      const k1 = makeCategoryKey('sys_cat_0', '特藏')
      const k2 = makeCategoryKey('sys_cat_0', '特藏')
      expect(k1).toBe(k2)
    })
  })

  describe('A-U3: null parentId 用 ROOT sentinel', () => {
    it('null parentId 的鍵含 ROOT sentinel', () => {
      const key = makeCategoryKey(null, '0 總類')
      // SPEC §2.2: `${parentId ?? 'ROOT'}::${name.toLowerCase()}`
      expect(key).toContain('ROOT')
    })

    it('null parentId 與另一 null parentId 同名相等', () => {
      const k1 = makeCategoryKey(null, '0 總類')
      const k2 = makeCategoryKey(null, '0 總類')
      expect(k1).toBe(k2)
    })
  })
})
