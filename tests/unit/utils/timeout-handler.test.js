/**
 * TimeoutHandler 測試
 */

const TimeoutHandler = require('../../../src/utils/timeout-handler')

describe('TimeoutHandler', () => {
  describe('createTimeout', () => {
    it('應該在Promise完成前返回Promise結果', async () => {
      const result = 'success'
      const promise = Promise.resolve(result)

      const actual = await TimeoutHandler.createTimeout(promise, 1000, 'timeout')
      expect(actual).toBe(result)
    })

    it('應該在超時時返回超時結果', async () => {
      const slowPromise = new Promise(resolve => setTimeout(resolve, 200))

      const actual = await TimeoutHandler.createTimeout(slowPromise, 50, 'timeout')
      expect(actual).toBe('timeout')
    })

    it('應該在超時時間內完成快速Promise', async () => {
      const fastPromise = Promise.resolve('fast')

      const actual = await TimeoutHandler.createTimeout(fastPromise, 1000, 'timeout')
      expect(actual).toBe('fast')
    })
  })
})
