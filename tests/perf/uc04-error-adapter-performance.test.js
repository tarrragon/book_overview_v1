/**
 * UC04ErrorAdapter 效能測試（非 npm test 主套件）
 *
 * 負責功能：
 * - UC-04 資料匯入錯誤轉換的批量轉換效能量測
 * - 大幅退化（gross-regression）防護
 *
 * 執行方式：
 * - 本檔位於 tests/perf/，不在 npm test（jest tests/unit tests/integration）掃描範圍。
 * - 透過 npm run test:perf（jest tests/perf）獨立執行。
 *
 * 量測環境限制（W4-010，延續 W1-017 方案 A）：
 * - Jest 在 jsdom 下執行，並非有效的效能量測環境。
 * - 計時值受全套件機器負載、JIT 暖機狀態、GC 時序影響，原 toBeLessThan(50) 絕對門檻
 *   在全套件負載下會 flaky（W4-002 實測同家族 toBeLessThan(10) 案例完整套件下 11ms 失敗）。
 * - 因此本檔的計時斷言定位為「大幅退化防護」，門檻刻意放寬到不受正常機器負載變異影響，
 *   只攔截數量級等級的災難性退化。
 * - 真正可靠的效能評估應在實機環境以專用 profiling 工具進行；本檔僅作開發期參考。
 *
 * 來源：tests/unit/core/errors/UC04ErrorAdapter.test.js 的「效能測試」describe 區塊
 * 遷移而來（W4-010，test-assertion-design-rules 規則 1/2）。
 */

import { UC04ErrorAdapter } from '../../src/core/errors/UC04ErrorAdapter.js'

describe('UC04ErrorAdapter 效能測試', () => {
  test('大量錯誤轉換不應出現數量級退化', () => {
    const startTime = Date.now()

    for (let i = 0; i < 100; i++) {
      UC04ErrorAdapter.convertError(
        'DATA_IMPORT_FILE_INVALID',
        `測試訊息 ${i}`,
        { testIndex: i }
      )
    }

    const duration = Date.now() - startTime
    // 大幅退化防護門檻，非效能 SLA。門檻放寬到不受正常機器負載變異影響。
    expect(duration).toBeLessThan(10000)
  })
})
