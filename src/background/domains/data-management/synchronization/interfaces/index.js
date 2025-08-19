/**
 * Synchronization Interfaces Index - 同步介面統一出口
 *
 * 負責功能：
 * - 統一匯出所有同步相關抽象介面
 * - 提供介面版本資訊和相容性檢查
 * - 建立介面使用的最佳實踐指導
 * - 支援介面的動態載入和驗證
 *
 * 設計考量：
 * - 單一出口：統一管理所有同步介面的匯出
 * - 版本控制：追蹤介面版本變更和相容性
 * - 載入效能：支援按需載入和批次載入
 * - 文件整合：提供完整的介面使用文件
 *
 * 使用情境：
 * - import { ISynchronizationCoordinator } from './interfaces'
 * - 實作類別繼承或實作介面規範
 * - 依賴注入系統的介面類型定義
 * - 測試框架的 Mock 介面基礎
 *
 * @version 1.0.0
 * @since 2025-08-19
 */

// 核心同步介面匯入
const ISynchronizationCoordinator = require('./ISynchronizationCoordinator.js')
const IDataComparator = require('./IDataComparator.js')
const IConflictResolver = require('./IConflictResolver.js')
const ISyncStrategyExecutor = require('./ISyncStrategyExecutor.js')

/**
 * 介面版本資訊
 */
const INTERFACE_VERSIONS = {
  ISynchronizationCoordinator: '1.0.0',
  IDataComparator: '1.0.0',
  IConflictResolver: '1.0.0',
  ISyncStrategyExecutor: '1.0.0'
}

/**
 * 介面相容性矩陣
 */
const COMPATIBILITY_MATRIX = {
  '1.0.0': {
    ISynchronizationCoordinator: ['1.0.0'],
    IDataComparator: ['1.0.0'],
    IConflictResolver: ['1.0.0'],
    ISyncStrategyExecutor: ['1.0.0']
  }
}

/**
 * 驗證介面實作類別是否符合規範
 * @param {Function} ImplementationClass - 實作類別
 * @param {Function} InterfaceClass - 介面類別
 * @returns {Object} 驗證結果 { isValid, missingMethods, extraMethods }
 */
function validateInterfaceImplementation (ImplementationClass, InterfaceClass) {
  const interfaceMethods = Object.getOwnPropertyNames(InterfaceClass.prototype)
    .filter(name => name !== 'constructor' && typeof InterfaceClass.prototype[name] === 'function')
  
  const implementationMethods = Object.getOwnPropertyNames(ImplementationClass.prototype)
    .filter(name => name !== 'constructor' && typeof ImplementationClass.prototype[name] === 'function')
  
  const missingMethods = interfaceMethods.filter(method => !implementationMethods.includes(method))
  const extraMethods = implementationMethods.filter(method => !interfaceMethods.includes(method))
  
  return {
    isValid: missingMethods.length === 0,
    missingMethods,
    extraMethods,
    totalRequired: interfaceMethods.length,
    totalImplemented: implementationMethods.length
  }
}

/**
 * 檢查介面版本相容性
 * @param {string} interfaceName - 介面名稱
 * @param {string} requiredVersion - 要求的版本
 * @returns {boolean} 是否相容
 */
function checkInterfaceCompatibility (interfaceName, requiredVersion) {
  const currentVersion = INTERFACE_VERSIONS[interfaceName]
  if (!currentVersion) {
    throw new Error(`Unknown interface: ${interfaceName}`)
  }
  
  const compatibleVersions = COMPATIBILITY_MATRIX[currentVersion]?.[interfaceName] || []
  return compatibleVersions.includes(requiredVersion)
}

/**
 * 獲取介面摘要資訊
 * @param {Function} InterfaceClass - 介面類別
 * @returns {Object} 介面摘要 { name, version, methods, constants }
 */
function getInterfaceSummary (InterfaceClass) {
  const methods = Object.getOwnPropertyNames(InterfaceClass.prototype)
    .filter(name => name !== 'constructor' && typeof InterfaceClass.prototype[name] === 'function')
  
  const constants = Object.getOwnPropertyNames(InterfaceClass)
    .filter(name => typeof InterfaceClass[name] === 'object')
  
  return {
    name: InterfaceClass.name,
    version: INTERFACE_VERSIONS[InterfaceClass.name] || 'unknown',
    methods: methods.length,
    constants: constants.length,
    methodList: methods,
    constantList: constants
  }
}

/**
 * 載入指定的介面
 * @param {string} interfaceName - 介面名稱
 * @returns {Function} 介面類別
 */
function loadInterface (interfaceName) {
  const interfaces = {
    ISynchronizationCoordinator,
    IDataComparator,
    IConflictResolver,
    ISyncStrategyExecutor
  }
  
  if (!interfaces[interfaceName]) {
    throw new Error(`Interface '${interfaceName}' not found`)
  }
  
  return interfaces[interfaceName]
}

/**
 * 獲取所有可用介面列表
 * @returns {Array<Object>} 介面列表 [{ name, version, description }]
 */
function getAvailableInterfaces () {
  return [
    {
      name: 'ISynchronizationCoordinator',
      version: INTERFACE_VERSIONS.ISynchronizationCoordinator,
      description: '同步協調器抽象介面 - 定義同步作業的核心操作方法'
    },
    {
      name: 'IDataComparator',
      version: INTERFACE_VERSIONS.IDataComparator,
      description: '資料比較器抽象介面 - 定義資料差異計算和變更檢測方法'
    },
    {
      name: 'IConflictResolver',
      version: INTERFACE_VERSIONS.IConflictResolver,
      description: '衝突解決器抽象介面 - 定義衝突檢測和解決策略方法'
    },
    {
      name: 'ISyncStrategyExecutor',
      version: INTERFACE_VERSIONS.ISyncStrategyExecutor,
      description: '同步策略執行器抽象介面 - 定義同步策略的執行和管理方法'
    }
  ]
}

// 主要匯出
module.exports = {
  // 核心介面
  ISynchronizationCoordinator,
  IDataComparator,
  IConflictResolver,
  ISyncStrategyExecutor,
  
  // 版本和相容性
  INTERFACE_VERSIONS,
  COMPATIBILITY_MATRIX,
  
  // 工具函數
  validateInterfaceImplementation,
  checkInterfaceCompatibility,
  getInterfaceSummary,
  loadInterface,
  getAvailableInterfaces,
  
  // 便捷別名
  interfaces: {
    ISynchronizationCoordinator,
    IDataComparator,
    IConflictResolver,
    ISyncStrategyExecutor
  }
}

// 瀏覽器環境支援
if (typeof window !== 'undefined') {
  window.SynchronizationInterfaces = module.exports
}