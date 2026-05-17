/**
 * MigrationService - Schema/Data 演進統一入口
 *
 * 負責功能：
 * - 註冊與管理多個 migration step（v1-to-v2、後續 cover-to-reader 等）
 * - 接收 install-handler 在 onUpdated 事件傳入的 previousVersion → currentVersion
 * - 依版本差異路由到對應的 migration step 並依序執行
 * - 提供 step 級別的失敗處理（單一 step 失敗中止後續，並回報錯誤）
 *
 * 設計考量：
 * - constructor 注入 chrome.storage.local 與 logger，便於單元測試以 mock 替換
 * - migration steps 以 { id, applies(prev, curr), run(storage, logger) } 介面註冊
 *   - applies 決定該 step 是否在此版本差異下需要執行（純函式，無副作用）
 *   - run 執行實際遷移邏輯，回傳結果物件（不應拋出未處理錯誤）
 * - 預設註冊 v1-to-v2 step，cover-to-reader 將於 W6-012.2.2.2 追加
 * - 不假設 chrome.runtime 存在；版本字串完全由呼叫端傳入
 *
 * 範圍邊界（W6-012.2.2.1）：
 * - 本檔僅實作骨架 + v1-to-v2 step 整合
 * - cover-to-reader migration step 屬 W6-012.2.2.2，不在此實作
 */

const { migrateV1ToV2 } = require('src/data-management/migration/v1-to-v2')
const { migrateCoverToReader } = require('src/data-management/migration/cover-to-reader')

/**
 * v1-to-v2 step 的 applies 判定
 *
 * 採寬鬆策略：任何 update 事件都嘗試執行，由 step 自身依
 * storage.schema_version 判斷是否跳過（checkMigrationNeeded）。
 *
 * 採寬鬆策略原因：
 * - 安裝事件的 previousVersion 是 extension 版本（manifest），非 schema 版本
 * - schema_version 真實狀態僅 storage 知道，避免在此重複實作判定邏輯
 */
function v1ToV2Applies (_previousVersion, _currentVersion) {
  return true
}

/**
 * cover-to-reader step 的 applies 判定
 *
 * 採寬鬆策略，與 v1-to-v2 同：由 step 自身依 storage.schema_version
 * 是否為 '3.1.0' 判斷是否跳過。
 */
function coverToReaderApplies (_previousVersion, _currentVersion) {
  return true
}

/**
 * 建立預設 migration step 清單
 *
 * @returns {Array<{id: string, applies: Function, run: Function}>}
 */
function createDefaultSteps () {
  return [
    {
      id: 'v1-to-v2',
      applies: v1ToV2Applies,
      run: async (storage, logger) => migrateV1ToV2(storage, logger)
    },
    {
      id: 'cover-to-reader',
      applies: coverToReaderApplies,
      run: async (storage, logger) => migrateCoverToReader(storage, logger)
    }
  ]
}

class MigrationService {
  /**
   * @param {Object} options
   * @param {Object} options.storage - Chrome storage.local API（含 get/set/remove）
   * @param {Object} [options.logger] - 日誌記錄器（含 info/warn/error/debug）
   * @param {Array}  [options.steps]  - 自訂 migration steps（測試或擴充用）
   */
  constructor (options = {}) {
    if (!options || !options.storage) {
      throw new Error('MigrationService requires storage dependency')
    }

    this.storage = options.storage
    this.logger = options.logger || console
    this.steps = Array.isArray(options.steps) ? options.steps.slice() : createDefaultSteps()
    this.isInitialized = false
    this.lastRunReport = null
  }

  /**
   * 初始化（由 install-handler 在 _doInitialize 中呼叫）
   * 目前不需特殊初始化動作；保留方法以符合 install-handler 對
   * migrationService.initialize 的可選呼叫慣例。
   */
  async initialize () {
    this.isInitialized = true
    if (this.logger && typeof this.logger.info === 'function') {
      this.logger.info('MigrationService initialized')
    }
  }

  /**
   * 註冊新的 migration step（供未來擴充，例如 cover-to-reader）
   *
   * @param {{id: string, applies: Function, run: Function}} step
   */
  registerStep (step) {
    if (!step || typeof step.id !== 'string' ||
        typeof step.applies !== 'function' ||
        typeof step.run !== 'function') {
      throw new Error('Invalid migration step: requires { id, applies, run }')
    }
    if (this.steps.some(existing => existing.id === step.id)) {
      throw new Error(`Migration step already registered: ${step.id}`)
    }
    this.steps.push(step)
  }

  /**
   * 執行版本差異對應的所有 migration steps
   *
   * 流程：
   *   1. 依註冊順序遍歷 steps，呼叫 applies(prev, curr)
   *   2. applies 為 true 的 step 依序執行 run(storage, logger)
   *   3. 任一 step 拋出例外或回報 error → 中止後續，回傳失敗報告
   *   4. 全部成功 → 回傳成功報告
   *
   * @param {string|null} previousVersion
   * @param {string|null} currentVersion
   * @returns {Promise<{success: boolean, executed: Array, skipped: Array, failed?: object}>}
   */
  async migrate (previousVersion, currentVersion) {
    const report = {
      success: true,
      previousVersion: previousVersion || null,
      currentVersion: currentVersion || null,
      executed: [],
      skipped: []
    }

    for (const step of this.steps) {
      let needsRun = false
      try {
        needsRun = step.applies(previousVersion, currentVersion)
      } catch (appliesError) {
        report.success = false
        report.failed = {
          id: step.id,
          phase: 'applies',
          error: appliesError.message
        }
        this._logError(`Migration step ${step.id} applies() failed: ${appliesError.message}`)
        this.lastRunReport = report
        return report
      }

      if (!needsRun) {
        report.skipped.push(step.id)
        continue
      }

      try {
        const result = await step.run(this.storage, this.logger)
        report.executed.push({ id: step.id, result })

        // v1-to-v2 step 採 { migrated: bool, error?: string } 格式
        if (result && result.error) {
          report.success = false
          report.failed = {
            id: step.id,
            phase: 'run',
            error: result.error
          }
          this.lastRunReport = report
          return report
        }
      } catch (runError) {
        report.success = false
        report.failed = {
          id: step.id,
          phase: 'run',
          error: runError.message
        }
        this._logError(`Migration step ${step.id} run() threw: ${runError.message}`)
        this.lastRunReport = report
        return report
      }
    }

    this.lastRunReport = report
    return report
  }

  /**
   * 統一錯誤日誌入口，避免 logger 缺方法時丟例外
   * @private
   */
  _logError (message) {
    if (this.logger && typeof this.logger.error === 'function') {
      this.logger.error(message)
    }
  }
}

module.exports = MigrationService
module.exports.createDefaultSteps = createDefaultSteps
