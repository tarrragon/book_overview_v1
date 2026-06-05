/**
 * Tag 樹狀 model 測試 fixture（SPEC-010 Phase 2）
 *
 * 提供小型樹建構 helper（2 根 + 次類），供各場景組整合測試獨立 import。
 * 用小型 fixture 替代 110 節點賴永祥真實資料，驗「機制」非「資料完整性」。
 *
 * TDD Phase 2（Red）：對應 Ticket 0.20.0-W2-007 / SPEC-010 §3
 */

/**
 * 建立 chrome.storage.local mock（單一裝置 store）。
 * @param {object} initial 初始 store 內容
 * @returns {{ store: object, restore: function }}
 */
function setupChromeStorageMock (initial = {}) {
  const store = { ...initial }
  global.chrome = global.chrome || {}
  global.chrome.storage = {
    local: {
      get: jest.fn(keys => {
        if (Array.isArray(keys)) {
          const out = {}
          keys.forEach(k => { out[k] = store[k] })
          return Promise.resolve(out)
        }
        return Promise.resolve({ ...store })
      }),
      set: jest.fn(obj => {
        Object.assign(store, obj)
        return Promise.resolve()
      })
    },
    sync: {
      get: jest.fn(() => Promise.resolve({})),
      set: jest.fn(() => Promise.resolve())
    }
  }
  return { store, restore: () => { delete global.chrome } }
}

/**
 * 小型預裝樹 fixture：2 根（0 總類 / 1 哲學類）+ 次類。
 * 確定性 ID，isSystem=true，對齊場景 D 預裝語意。
 */
function makePresetTreeFixture () {
  return [
    { id: 'sys_cat_0', name: '0 總類', parentId: null, isSystem: true },
    { id: 'sys_cat_00', name: '00 特藏', parentId: 'sys_cat_0', isSystem: true },
    { id: 'sys_cat_01', name: '01 目錄學', parentId: 'sys_cat_0', isSystem: true },
    { id: 'sys_cat_1', name: '1 哲學類', parentId: null, isSystem: true }
  ]
}

/**
 * 線性深度樹 fixture：root(depth0) → d1 → d2 → d3（葉）。
 * 供場景 B MAX_DEPTH 測試。
 */
function makeLinearDepthFixture () {
  return [
    { id: 'd0', name: 'depth0', parentId: null, isSystem: false },
    { id: 'd1', name: 'depth1', parentId: 'd0', isSystem: false },
    { id: 'd2', name: 'depth2', parentId: 'd1', isSystem: false },
    { id: 'd3', name: 'depth3', parentId: 'd2', isSystem: false }
  ]
}

module.exports = {
  setupChromeStorageMock,
  makePresetTreeFixture,
  makeLinearDepthFixture
}
