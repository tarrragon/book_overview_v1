/**
 * Data Consistency Checker - 資料一致性檢查器
 * 用於測試中驗證資料一致性
 */

class DataConsistencyChecker {
  constructor() {
    this.checkResults = []
  }

  /**
   * 檢查書籍資料一致性
   */
  checkBookDataConsistency(sourceData, targetData) {
    const inconsistencies = []

    // 檢查基本欄位
    const requiredFields = ['id', 'title', 'authors']
    
    for (const field of requiredFields) {
      if (sourceData[field] !== targetData[field]) {
        inconsistencies.push({
          field,
          source: sourceData[field],
          target: targetData[field],
          type: 'field_mismatch'
        })
      }
    }

    // 檢查陣列欄位
    if (JSON.stringify(sourceData.authors) !== JSON.stringify(targetData.authors)) {
      inconsistencies.push({
        field: 'authors',
        source: sourceData.authors,
        target: targetData.authors,
        type: 'array_mismatch'
      })
    }

    const result = {
      consistent: inconsistencies.length === 0,
      inconsistencies,
      checkedAt: new Date()
    }

    this.checkResults.push(result)
    return result
  }

  /**
   * 檢查陣列資料一致性
   */
  checkArrayConsistency(sourceArray, targetArray) {
    const result = {
      lengthMatch: sourceArray.length === targetArray.length,
      sourceLength: sourceArray.length,
      targetLength: targetArray.length,
      missingInTarget: [],
      extraInTarget: [],
      consistent: false
    }

    // 檢查缺失項目
    for (const sourceItem of sourceArray) {
      const found = targetArray.find(item => 
        JSON.stringify(item) === JSON.stringify(sourceItem)
      )
      if (!found) {
        result.missingInTarget.push(sourceItem)
      }
    }

    // 檢查多餘項目
    for (const targetItem of targetArray) {
      const found = sourceArray.find(item => 
        JSON.stringify(item) === JSON.stringify(targetItem)
      )
      if (!found) {
        result.extraInTarget.push(targetItem)
      }
    }

    result.consistent = result.missingInTarget.length === 0 && 
                       result.extraInTarget.length === 0

    return result
  }

  /**
   * 獲取檢查歷史
   */
  getCheckHistory() {
    return this.checkResults
  }

  /**
   * 重置檢查結果
   */
  reset() {
    this.checkResults = []
  }
}

module.exports = DataConsistencyChecker