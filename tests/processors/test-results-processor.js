/**
 * 測試結果處理器
 * 處理 Jest 測試結果並產生自定義報告
 */

module.exports = (results) => {
  // 簡單的結果處理，可以根據需要擴展
  console.log(`   通過: ${results.numPassedTests} 個`)
  console.log(`   失敗: ${results.numFailedTests} 個`)

  return results
}
