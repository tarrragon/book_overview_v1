/**
 * UIEventValidator 測試
 * 測試 UI 事件驗證工具類的功能
 */

const UIEventValidator = require('../../../src/ui/handlers/ui-event-validator')

describe('UIEventValidator', () => {
  describe('事件結構驗證', () => {
    test('應該接受有效的事件物件', () => {
      const validEvent = {
        type: 'TEST.EVENT',
        flowId: 'test-flow-123',
        data: { message: 'test' }
      }

      expect(() => {
        UIEventValidator.validateEventStructure(validEvent)
      }).not.toThrow()
    })

    test('應該拒絕無效的事件物件', () => {
      const invalidEvents = [
        null,
        undefined,
        'string',
        123,
        { type: 'TEST' }, // 缺少 flowId
        {} // 空物件
      ]

      invalidEvents.forEach(invalidEvent => {
        expect(() => {
          UIEventValidator.validateEventStructure(invalidEvent)
        }).toThrow()
      })
    })
  })

  describe('資料結構驗證', () => {
    test('應該接受有效的資料物件', () => {
      const validData = { message: 'test', type: 'info' }

      expect(() => {
        UIEventValidator.validateDataStructure(validData, 'test data')
      }).not.toThrow()
    })

    test('應該拒絕無效的資料物件', () => {
      const invalidData = [null, undefined, 'string', 123]

      invalidData.forEach(data => {
        expect(() => {
          UIEventValidator.validateDataStructure(data, 'test data')
        }).toThrow()
      })
    })
  })

  describe('字串欄位驗證', () => {
    test('應該接受有效的字串', () => {
      expect(() => {
        UIEventValidator.validateStringField('valid string', 'testField')
      }).not.toThrow()
    })

    test('應該拒絕空字串（當必填時）', () => {
      const invalidValues = [null, undefined, '', '   ', 123, {}]

      invalidValues.forEach(value => {
        expect(() => {
          UIEventValidator.validateStringField(value, 'testField')
        }).toThrow()
      })
    })

    test('應該支援長度限制', () => {
      expect(() => {
        UIEventValidator.validateStringField('test', 'testField', { minLength: 5 })
      }).toThrow()

      expect(() => {
        UIEventValidator.validateStringField('toolongstring', 'testField', { maxLength: 5 })
      }).toThrow()

      expect(() => {
        UIEventValidator.validateStringField('good', 'testField', {
          minLength: 2, maxLength: 10
        })
      }).not.toThrow()
    })
  })

  describe('數值欄位驗證', () => {
    test('應該接受有效的數值', () => {
      expect(() => {
        UIEventValidator.validateNumberField(42, 'testField')
      }).not.toThrow()
    })

    test('應該拒絕非數值', () => {
      const invalidValues = [null, undefined, 'string', {}, [], NaN]

      invalidValues.forEach(value => {
        expect(() => {
          UIEventValidator.validateNumberField(value, 'testField')
        }).toThrow()
      })
    })

    test('應該支援範圍限制', () => {
      expect(() => {
        UIEventValidator.validateNumberField(-1, 'testField', { min: 0 })
      }).toThrow()

      expect(() => {
        UIEventValidator.validateNumberField(101, 'testField', { max: 100 })
      }).toThrow()

      expect(() => {
        UIEventValidator.validateNumberField(50, 'testField', { min: 0, max: 100 })
      }).not.toThrow()
    })

    test('應該支援整數驗證', () => {
      expect(() => {
        UIEventValidator.validateNumberField(3.14, 'testField', { integer: true })
      }).toThrow()

      expect(() => {
        UIEventValidator.validateNumberField(42, 'testField', { integer: true })
      }).not.toThrow()
    })
  })

  describe('枚舉欄位驗證', () => {
    test('應該接受有效的枚舉值', () => {
      const validValues = ['success', 'error', 'warning']

      expect(() => {
        UIEventValidator.validateEnumField('success', 'testField', validValues)
      }).not.toThrow()
    })

    test('應該拒絕無效的枚舉值', () => {
      const validValues = ['success', 'error', 'warning']

      expect(() => {
        UIEventValidator.validateEnumField('invalid', 'testField', validValues)
      }).toThrow()
    })

    test('應該支援可選欄位', () => {
      const validValues = ['success', 'error', 'warning']

      expect(() => {
        UIEventValidator.validateEnumField(undefined, 'testField', validValues, {
          required: false
        })
      }).not.toThrow()
    })
  })
})
