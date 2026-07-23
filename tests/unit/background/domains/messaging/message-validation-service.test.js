/**
 * @fileoverview Message Validation Service 單元測試
 *
 * 對應 domain-map 不變式：request envelope 必須含 type 欄位；
 * response success=false 時 error 必填。
 */

const { MessageValidationService } = require('src/background/domains/messaging/services/message-validation-service.js')

describe('MessageValidationService', () => {
  let service
  let mockLogger

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    }

    service = new MessageValidationService({ logger: mockLogger })
  })

  describe('request envelope 必須含 type 欄位', () => {
    test('訊息缺少 type 欄位時，結構驗證應標記為不合法', async () => {
      const result = await service.validateMessage({ data: {} })

      expect(result.valid).toBe(false)
      expect(result.violations.some(v => v.field === 'type')).toBe(true)
    })

    test('訊息包含合法 type 與 data 欄位時，結構驗證應標記為合法', async () => {
      const result = await service.validateMessage({ type: 'CONTENT_REQUEST', data: {} })

      expect(result.valid).toBe(true)
      expect(result.violations).toHaveLength(0)
    })
  })

  describe('response success=false 時 error 必填', () => {
    test('驗證不合法時，每筆 violation 必須包含非空的 message 說明', async () => {
      const result = await service.validateMessage({ data: {} })

      expect(result.valid).toBe(false)
      expect(result.violations.length).toBeGreaterThan(0)
      result.violations.forEach(violation => {
        expect(typeof violation.message).toBe('string')
        expect(violation.message.length).toBeGreaterThan(0)
      })
    })
  })
})
