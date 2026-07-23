/**
 * MigrationValidator 單元測試（Migration Tools bundle）
 *
 * 對應 docs/spec/core/domain-map.md 不變式：
 * 「MigrationValidator 驗證通過才允許遷移執行」
 *
 * 設計考量：validateFile() 內部呼叫 fs.readFile / execSync（ESLint、Jest）等真實 I/O，
 * 為避免單元測試依賴檔案系統與子行程，改用 spy 取代 _validateByType 驗證編排邏輯，
 * 並直接測試不涉及 I/O 的 validateErrorCodeMapping() 純函式邏輯。
 */

const { MigrationValidator, VALIDATION_RESULT } = require('src/core/migration/MigrationValidator')

describe('MigrationValidator', () => {
  let validator

  beforeEach(() => {
    validator = new MigrationValidator({ projectRoot: '/fake/project' })
  })

  describe('驗證通過才允許遷移執行（overall 結果聚合邏輯）', () => {
    test('全部子驗證通過時，overall 為 PASS', async () => {
      jest.spyOn(validator, '_validateByType').mockResolvedValue({
        result: VALIDATION_RESULT.PASS,
        issues: [],
        recommendations: []
      })

      const result = await validator.validateFile('/fake/project/src/foo.js')

      expect(result.overall).toBe(VALIDATION_RESULT.PASS)
    })

    test('任一子驗證為 FAIL 時，overall 降級為 FAIL（阻擋遷移執行）', async () => {
      jest.spyOn(validator, '_validateByType').mockImplementation(async (filePath, type) => {
        if (type === 'testing') {
          return { result: VALIDATION_RESULT.FAIL, issues: [{ severity: 'error', message: '測試失敗' }], recommendations: [] }
        }
        return { result: VALIDATION_RESULT.PASS, issues: [], recommendations: [] }
      })

      const result = await validator.validateFile('/fake/project/src/foo.js')

      expect(result.overall).toBe(VALIDATION_RESULT.FAIL)
    })

    test('無 FAIL 但有 WARNING 時，overall 為 WARNING（允許但需注意）', async () => {
      jest.spyOn(validator, '_validateByType').mockImplementation(async (filePath, type) => {
        if (type === 'syntax') {
          return { result: VALIDATION_RESULT.WARNING, issues: [{ severity: 'warning', message: 'lint 警告' }], recommendations: [] }
        }
        return { result: VALIDATION_RESULT.PASS, issues: [], recommendations: [] }
      })

      const result = await validator.validateFile('/fake/project/src/foo.js')

      expect(result.overall).toBe(VALIDATION_RESULT.WARNING)
    })
  })

  describe('validateErrorCodeMapping（遷移前後錯誤映射一致性驗證）', () => {
    test('code / message / details 完全一致時回傳 PASS', async () => {
      const originalError = { code: 'ERR_A', message: '相同訊息', details: { userId: 1 } }
      const convertedError = { code: 'ERR_A', message: '相同訊息', details: { userId: 1 } }

      const mapping = await validator.validateErrorCodeMapping(originalError, convertedError)

      expect(mapping.result).toBe(VALIDATION_RESULT.PASS)
      expect(mapping.mapping.detailsPreserved).toBe(true)
    })

    test('details 遺漏欄位時 detailsPreserved 為 false 且回傳 WARNING', async () => {
      const originalError = { code: 'ERR_A', message: '相同訊息', details: { userId: 1, context: 'x' } }
      const convertedError = { code: 'ERR_A', message: '相同訊息', details: { userId: 1 } }

      const mapping = await validator.validateErrorCodeMapping(originalError, convertedError)

      expect(mapping.mapping.detailsPreserved).toBe(false)
      expect(mapping.result).toBe(VALIDATION_RESULT.WARNING)
    })
  })
})
