/**
 * Schema 共用驗證引擎
 *
 * 提供 BookSchemaV2 和 TagSchema 共用的欄位驗證邏輯，
 * 消除兩處 Schema 各自實作結構相同驗證的 DRY 違反。
 *
 * 支援的驗證規則：
 * - 必填檢查（含 auto 欄位跳過選項）
 * - 型別檢查（string, number, boolean, array）
 * - 列舉值檢查
 * - 數值範圍檢查（min, max）
 * - 字串長度檢查（maxLength）
 * - 正則格式檢查（pattern）
 * - 陣列元素型別檢查（items）
 *
 * @version 1.0.0
 */

/**
 * 檢查值的型別是否符合預期
 * @param {*} value - 要檢查的值
 * @param {string} expectedType - 預期型別（'string', 'number', 'boolean', 'array'）
 * @returns {boolean}
 */
function checkType (value, expectedType) {
  if (expectedType === 'array') {
    return Array.isArray(value)
  }
  return typeof value === expectedType
}

/**
 * 驗證單一欄位值是否符合 schema 定義
 *
 * @param {string} fieldName - 欄位名稱
 * @param {*} value - 欄位值
 * @param {Object} fieldDef - 欄位定義（含 type, required, auto, enum, min, max, maxLength, pattern, items）
 * @param {Object} [options] - 驗證選項
 * @param {boolean} [options.skipAutoRequired=false] - 為 true 時，auto 欄位跳過必填檢查
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateField (fieldName, value, fieldDef, options = {}) {
  const skipAutoRequired = options.skipAutoRequired || false

  // 必填檢查
  if (fieldDef.required) {
    const shouldSkip = skipAutoRequired && fieldDef.auto
    if (!shouldSkip && (value === undefined || value === null || value === '')) {
      return { valid: false, error: `必填欄位 '${fieldName}' 缺失` }
    }
  }

  // 值為 undefined/null 且非必填（或已跳過必填），允許通過
  if (value === undefined || value === null) {
    return { valid: true, error: null }
  }

  // 型別檢查
  if (!checkType(value, fieldDef.type)) {
    return { valid: false, error: `欄位 '${fieldName}' 型別錯誤：期望 ${fieldDef.type}，實際 ${typeof value}` }
  }

  // 列舉值檢查
  if (fieldDef.enum && !fieldDef.enum.includes(value)) {
    return { valid: false, error: `欄位 '${fieldName}' 值 '${value}' 不在允許列舉中` }
  }

  // 數值範圍檢查
  if (fieldDef.type === 'number') {
    if (fieldDef.min !== undefined && value < fieldDef.min) {
      return { valid: false, error: `欄位 '${fieldName}' 值 ${value} 小於最小值 ${fieldDef.min}` }
    }
    if (fieldDef.max !== undefined && value > fieldDef.max) {
      return { valid: false, error: `欄位 '${fieldName}' 值 ${value} 大於最大值 ${fieldDef.max}` }
    }
  }

  // 字串長度檢查
  if (fieldDef.maxLength && typeof value === 'string' && value.length > fieldDef.maxLength) {
    return { valid: false, error: `欄位 '${fieldName}' 超過最大長度 ${fieldDef.maxLength}` }
  }

  // 正則格式檢查
  if (fieldDef.pattern && typeof value === 'string' && !fieldDef.pattern.test(value)) {
    return { valid: false, error: `欄位 '${fieldName}' 格式不符：期望符合 pattern` }
  }

  // 陣列元素型別檢查
  if (fieldDef.type === 'array' && fieldDef.items && Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (!checkType(value[i], fieldDef.items)) {
        return { valid: false, error: `欄位 '${fieldName}[${i}]' 元素型別錯誤：期望 ${fieldDef.items}` }
      }
    }
  }

  return { valid: true, error: null }
}

/**
 * 驗證完整物件是否符合 schema 定義
 *
 * @param {Object} obj - 要驗證的物件
 * @param {Object} schema - schema 定義（含 fields 屬性）
 * @param {string} entityName - 實體名稱（用於錯誤訊息）
 * @param {Object} [options] - 驗證選項（傳遞給 validateField）
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateObject (obj, schema, entityName, options = {}) {
  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: [`${entityName} 必須是非 null 的物件`] }
  }

  const errors = []
  const fields = schema.fields

  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    const result = validateField(fieldName, obj[fieldName], fieldDef, options)
    if (!result.valid) {
      errors.push(result.error)
    }
  }

  return { valid: errors.length === 0, errors }
}

// === 匯出 ===

const SchemaValidator = {
  checkType,
  validateField,
  validateObject
}

module.exports = SchemaValidator
