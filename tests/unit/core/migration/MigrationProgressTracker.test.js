/**
 * MigrationProgressTracker 單元測試（Migration Tools bundle）
 *
 * 對應 docs/spec/core/domain-map.md 不變式：「遷移進度 0-100% 單調遞增」
 *
 * 設計考量：registerMigrationItem / updateItemStatus 內部呼叫 _saveState()
 * 寫入真實檔案系統，測試以 jest.mock('fs') 取代真實 I/O 以避免污染工作目錄。
 */

jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockRejectedValue(new Error('ENOENT')),
    mkdir: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockRejectedValue(new Error('ENOENT'))
  }
}))

const { MigrationProgressTracker, MIGRATION_STATUS } = require('src/core/migration/MigrationProgressTracker')

describe('MigrationProgressTracker', () => {
  test('遷移進度百分比隨完成項目數增加而單調遞增，且落在 0-100% 範圍內', async () => {
    const tracker = new MigrationProgressTracker({ projectRoot: '/fake/project' })

    const itemIds = []
    for (let i = 0; i < 4; i++) {
      const id = await tracker.registerMigrationItem(`/fake/project/src/file${i}.js`, {
        type: 'throw',
        line: i,
        column: 0,
        originalCode: 'throw new StandardError()'
      })
      itemIds.push(id)
    }

    expect(tracker.getProgress().percentage).toBe(0)

    let previousPercentage = 0
    for (const id of itemIds) {
      await tracker.updateItemStatus(id, MIGRATION_STATUS.COMPLETED)

      const { percentage } = tracker.getProgress()

      expect(percentage).toBeGreaterThanOrEqual(previousPercentage)
      expect(percentage).toBeGreaterThanOrEqual(0)
      expect(percentage).toBeLessThanOrEqual(100)

      previousPercentage = percentage
    }

    expect(previousPercentage).toBe(100)
  })

  test('項目狀態由 COMPLETED 改回非 COMPLETED 時，進度百分比隨之下降', async () => {
    const tracker = new MigrationProgressTracker({ projectRoot: '/fake/project' })

    const id = await tracker.registerMigrationItem('/fake/project/src/file.js', {
      type: 'throw',
      line: 1,
      column: 0,
      originalCode: 'throw new StandardError()'
    })

    await tracker.updateItemStatus(id, MIGRATION_STATUS.COMPLETED)
    expect(tracker.getProgress().percentage).toBe(100)

    await tracker.updateItemStatus(id, MIGRATION_STATUS.FAILED)
    expect(tracker.getProgress().percentage).toBe(0)
  })
})
