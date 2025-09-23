/**
 * TimeoutHandler 測試
 */

// eslint-disable-next-line no-unused-vars
const TimeoutHandler = require('src/utils/timeout-handler')

describe('TimeoutHandler', () => {
  describe('createTimeout', () => {
    it('應該在Promise完成前返回Promise結果', async () => {
      // eslint-disable-next-line no-unused-vars
      const result = 'success'
      // eslint-disable-next-line no-unused-vars
      const promise = Promise.resolve(result)

      // eslint-disable-next-line no-unused-vars
      const actual = await TimeoutHandler.createTimeout(promise, 1000, 'timeout')
      expect(actual).toBe(result)
    })

    it('應該在超時時返回超時結果', async () => {
      // eslint-disable-next-line no-unused-vars
      const slowPromise = new Promise(resolve => setTimeout(resolve, 200))

      // eslint-disable-next-line no-unused-vars
      const actual = await TimeoutHandler.createTimeout(slowPromise, 50, 'timeout')
      expect(actual).toBe('timeout')
    })

    it('應該在超時時間內完成快速Promise', async () => {
      // eslint-disable-next-line no-unused-vars
      const fastPromise = Promise.resolve('fast')

      // eslint-disable-next-line no-unused-vars
      const actual = await TimeoutHandler.createTimeout(fastPromise, 1000, 'timeout')
      expect(actual).toBe('fast')
    })
  })
})
