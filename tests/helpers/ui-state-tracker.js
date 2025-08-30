/**
 * UI State Tracker - UI狀態追蹤工具
 * 用於測試中追蹤和驗證UI元素的狀態變化
 */

class UIStateTracker {
  constructor() {
    this.stateHistory = []
    this.currentState = {}
    this.watchers = new Map()
  }

  /**
   * 記錄UI狀態快照
   */
  captureState(stateName, elements) {
    const snapshot = {
      name: stateName,
      timestamp: new Date().toISOString(),
      elements: this._extractElementStates(elements)
    }
    
    this.stateHistory.push(snapshot)
    this.currentState = snapshot
    
    return snapshot
  }

  /**
   * 提取元素狀態資訊
   */
  _extractElementStates(elements) {
    const states = {}
    
    for (const [key, element] of Object.entries(elements)) {
      if (element) {
        states[key] = {
          visible: element.style && element.style.display !== 'none',
          enabled: !element.disabled,
          text: element.textContent || element.value || '',
          classes: element.className || '',
          attributes: this._extractAttributes(element)
        }
      }
    }
    
    return states
  }

  /**
   * 提取元素屬性
   */
  _extractAttributes(element) {
    const attributes = {}
    
    if (element.attributes) {
      for (const attr of element.attributes) {
        attributes[attr.name] = attr.value
      }
    }
    
    return attributes
  }

  /**
   * 比較兩個狀態
   */
  compareStates(state1Name, state2Name) {
    const state1 = this.findState(state1Name)
    const state2 = this.findState(state2Name)
    
    if (!state1 || !state2) {
      throw new Error(`無法找到狀態: ${state1Name} 或 ${state2Name}`)
    }
    
    return this._deepCompare(state1.elements, state2.elements)
  }

  /**
   * 深度比較狀態物件
   */
  _deepCompare(obj1, obj2) {
    const differences = []
    
    const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)])
    
    for (const key of allKeys) {
      if (!obj1[key] && obj2[key]) {
        differences.push({ type: 'added', element: key, value: obj2[key] })
      } else if (obj1[key] && !obj2[key]) {
        differences.push({ type: 'removed', element: key, value: obj1[key] })
      } else if (obj1[key] && obj2[key]) {
        const elementDiffs = this._compareElements(obj1[key], obj2[key], key)
        differences.push(...elementDiffs)
      }
    }
    
    return differences
  }

  /**
   * 比較單一元素狀態
   */
  _compareElements(elem1, elem2, elementName) {
    const differences = []
    
    const properties = ['visible', 'enabled', 'text', 'classes']
    
    for (const prop of properties) {
      if (elem1[prop] !== elem2[prop]) {
        differences.push({
          type: 'changed',
          element: elementName,
          property: prop,
          oldValue: elem1[prop],
          newValue: elem2[prop]
        })
      }
    }
    
    return differences
  }

  /**
   * 尋找特定狀態
   */
  findState(stateName) {
    return this.stateHistory.find(state => state.name === stateName)
  }

  /**
   * 驗證狀態變化
   */
  verifyStateTransition(expectedChanges) {
    const recentStates = this.stateHistory.slice(-2)
    
    if (recentStates.length < 2) {
      throw new Error('需要至少兩個狀態來驗證轉換')
    }
    
    const [previousState, currentState] = recentStates
    const actualChanges = this._deepCompare(previousState.elements, currentState.elements)
    
    return this._validateExpectedChanges(expectedChanges, actualChanges)
  }

  /**
   * 驗證預期變化
   */
  _validateExpectedChanges(expected, actual) {
    const results = {
      passed: true,
      missingChanges: [],
      unexpectedChanges: [],
      correctChanges: []
    }
    
    // 檢查預期的變化是否發生
    for (const expectedChange of expected) {
      const found = actual.find(change => 
        change.element === expectedChange.element &&
        change.property === expectedChange.property &&
        change.newValue === expectedChange.newValue
      )
      
      if (found) {
        results.correctChanges.push(expectedChange)
      } else {
        results.missingChanges.push(expectedChange)
        results.passed = false
      }
    }
    
    // 檢查是否有未預期的變化
    for (const actualChange of actual) {
      const expected = expected.find(change =>
        change.element === actualChange.element &&
        change.property === actualChange.property
      )
      
      if (!expected) {
        results.unexpectedChanges.push(actualChange)
      }
    }
    
    return results
  }

  /**
   * 重置追蹤器
   */
  reset() {
    this.stateHistory = []
    this.currentState = {}
    this.watchers.clear()
  }

  /**
   * 取得狀態歷史
   */
  getStateHistory() {
    return [...this.stateHistory]
  }
}

module.exports = UIStateTracker