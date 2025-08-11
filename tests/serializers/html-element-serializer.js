/**
 * HTML 元素序列化器
 * 為 Jest 快照測試序列化 DOM 元素
 */

module.exports = {
  test (val) {
    return val && val.nodeType === 1 // Element node
  },

  serialize (val) {
    return val.outerHTML || ''
  }
}
