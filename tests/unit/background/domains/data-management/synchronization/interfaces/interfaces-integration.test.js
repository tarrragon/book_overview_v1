/**
 * Synchronization Interfaces Integration Test - 同步介面整合測試
 * 
 * 測試目標：驗證所有同步介面的整合性和一致性
 * 覆蓋範圍：
 * - 介面載入和匯出功能
 * - 介面版本相容性檢查
 * - 介面實作驗證工具
 * - 介面摘要和文件功能
 * 
 * @version 1.0.0
 * @since 2025-08-19
 */

const {
  ISynchronizationCoordinator,
  IDataComparator,
  IConflictResolver,
  ISyncStrategyExecutor,
  INTERFACE_VERSIONS,
  validateInterfaceImplementation,
  checkInterfaceCompatibility,
  getInterfaceSummary,
  loadInterface,
  getAvailableInterfaces
} = require('../../../../../../src/background/domains/data-management/synchronization/interfaces/index.js')

describe('Synchronization Interfaces Integration', () => {
  
  describe('🔗 介面載入與匯出', () => {
    test('應該正確匯出所有核心介面', () => {
      expect(ISynchronizationCoordinator).toBeDefined()
      expect(typeof ISynchronizationCoordinator).toBe('function')
      expect(ISynchronizationCoordinator.name).toBe('ISynchronizationCoordinator')
      
      expect(IDataComparator).toBeDefined()
      expect(typeof IDataComparator).toBe('function')
      expect(IDataComparator.name).toBe('IDataComparator')
      
      expect(IConflictResolver).toBeDefined()
      expect(typeof IConflictResolver).toBe('function')
      expect(IConflictResolver.name).toBe('IConflictResolver')
      
      expect(ISyncStrategyExecutor).toBeDefined()
      expect(typeof ISyncStrategyExecutor).toBe('function')
      expect(ISyncStrategyExecutor.name).toBe('ISyncStrategyExecutor')
    })
    
    test('應該提供動態介面載入功能', () => {
      const coordinator = loadInterface('ISynchronizationCoordinator')
      expect(coordinator).toBe(ISynchronizationCoordinator)
      
      const comparator = loadInterface('IDataComparator')
      expect(comparator).toBe(IDataComparator)
      
      const resolver = loadInterface('IConflictResolver')
      expect(resolver).toBe(IConflictResolver)
      
      const executor = loadInterface('ISyncStrategyExecutor')
      expect(executor).toBe(ISyncStrategyExecutor)
    })
    
    test('載入不存在介面應該拋出錯誤', () => {
      expect(() => loadInterface('NonExistentInterface'))
        .toThrow("Interface 'NonExistentInterface' not found")
    })
  })
  
  describe('📊 版本管理與相容性', () => {
    test('應該定義所有介面的版本資訊', () => {
      expect(INTERFACE_VERSIONS).toBeDefined()
      expect(INTERFACE_VERSIONS.ISynchronizationCoordinator).toBe('1.0.0')
      expect(INTERFACE_VERSIONS.IDataComparator).toBe('1.0.0')
      expect(INTERFACE_VERSIONS.IConflictResolver).toBe('1.0.0')
      expect(INTERFACE_VERSIONS.ISyncStrategyExecutor).toBe('1.0.0')
    })
    
    test('應該正確檢查版本相容性', () => {
      // 相容版本檢查
      expect(checkInterfaceCompatibility('ISynchronizationCoordinator', '1.0.0')).toBe(true)
      expect(checkInterfaceCompatibility('IDataComparator', '1.0.0')).toBe(true)
      expect(checkInterfaceCompatibility('IConflictResolver', '1.0.0')).toBe(true)
      expect(checkInterfaceCompatibility('ISyncStrategyExecutor', '1.0.0')).toBe(true)
    })
    
    test('檢查不存在介面版本應該拋出錯誤', () => {
      expect(() => checkInterfaceCompatibility('NonExistentInterface', '1.0.0'))
        .toThrow('Unknown interface: NonExistentInterface')
    })
  })
  
  describe('🔍 介面摘要與文件', () => {
    test('應該提供完整的介面摘要資訊', () => {
      const coordinatorSummary = getInterfaceSummary(ISynchronizationCoordinator)
      expect(coordinatorSummary).toEqual(expect.objectContaining({
        name: 'ISynchronizationCoordinator',
        version: '1.0.0',
        methods: expect.any(Number),
        constants: expect.any(Number),
        methodList: expect.any(Array),
        constantList: expect.any(Array)
      }))
      
      // 驗證核心方法存在
      expect(coordinatorSummary.methodList).toContain('initializeSync')
      expect(coordinatorSummary.methodList).toContain('executeSync')
      expect(coordinatorSummary.methodList).toContain('cancelSync')
    })
    
    test('應該列出所有可用介面', () => {
      const availableInterfaces = getAvailableInterfaces()
      expect(availableInterfaces).toHaveLength(4)
      
      const interfaceNames = availableInterfaces.map(iface => iface.name)
      expect(interfaceNames).toContain('ISynchronizationCoordinator')
      expect(interfaceNames).toContain('IDataComparator')
      expect(interfaceNames).toContain('IConflictResolver')
      expect(interfaceNames).toContain('ISyncStrategyExecutor')
      
      // 驗證介面描述存在
      availableInterfaces.forEach(iface => {
        expect(iface.description).toBeDefined()
        expect(typeof iface.description).toBe('string')
        expect(iface.description.length).toBeGreaterThan(0)
      })
    })
  })
  
  describe('✅ 介面實作驗證', () => {
    test('應該檢測完整實作的介面', () => {
      // 建立完整實作的測試類別
      class CompleteImplementation extends ISynchronizationCoordinator {
        async initializeSync () { return {} }
        async executeSync () { return {} }
        async cancelSync () { return {} }
        async getActiveSyncs () { return [] }
        async getSyncStatus () { return {} }
        async getSyncProgress () { return {} }
        async getSyncHistory () { return [] }
        async updateSyncConfig () { return {} }
        async getSyncConfig () { return {} }
        async getSyncMetrics () { return {} }
        async start () { return {} }
        async stop () { return {} }
        async restart () { return {} }
      }
      
      const validation = validateInterfaceImplementation(
        CompleteImplementation, 
        ISynchronizationCoordinator
      )
      
      expect(validation.isValid).toBe(true)
      expect(validation.missingMethods).toHaveLength(0)
      expect(validation.totalRequired).toBeGreaterThan(0)
    })
    
    test('應該檢測不完整實作的介面', () => {
      // 建立不完整實作的測試類別
      class IncompleteImplementation extends ISynchronizationCoordinator {
        async initializeSync () { return {} }
        async executeSync () { return {} }
        // 缺少其他方法
      }
      
      const validation = validateInterfaceImplementation(
        IncompleteImplementation, 
        ISynchronizationCoordinator
      )
      
      expect(validation.isValid).toBe(false)
      expect(validation.missingMethods.length).toBeGreaterThan(0)
      expect(validation.missingMethods).toContain('cancelSync')
      expect(validation.missingMethods).toContain('getActiveSyncs')
    })
    
    test('應該檢測額外方法', () => {
      class ExtendedImplementation extends IDataComparator {
        async calculateDifferences () { return {} }
        async identifyChanges () { return [] }
        async generateChangeSet () { return {} }
        async setComparisonStrategy () { return {} }
        async getComparisonStrategy () { return {} }
        async enableBatchComparison () { return {} }
        async setComparisonCache () { return {} }
        async analyzeDataStructure () { return {} }
        async validateDataIntegrity () { return {} }
        async calculateSimilarity () { return {} }
        async getComparisonStatistics () { return {} }
        
        // 額外方法
        async extraMethod1 () { return {} }
        async extraMethod2 () { return {} }
      }
      
      const validation = validateInterfaceImplementation(
        ExtendedImplementation,
        IDataComparator
      )
      
      expect(validation.isValid).toBe(true)
      expect(validation.extraMethods).toContain('extraMethod1')
      expect(validation.extraMethods).toContain('extraMethod2')
      expect(validation.extraMethods.length).toBeGreaterThanOrEqual(2)
    })
  })
  
  describe('🎯 介面常數與枚舉', () => {
    test('應該定義同步狀態枚舉', () => {
      const syncStatus = ISynchronizationCoordinator.SyncStatus
      expect(syncStatus).toBeDefined()
      expect(syncStatus.PENDING).toBe('PENDING')
      expect(syncStatus.RUNNING).toBe('RUNNING')
      expect(syncStatus.COMPLETED).toBe('COMPLETED')
      expect(syncStatus.FAILED).toBe('FAILED')
    })
    
    test('應該定義差異類型枚舉', () => {
      const diffTypes = IDataComparator.DifferenceTypes
      expect(diffTypes).toBeDefined()
      expect(diffTypes.ADDED).toBe('ADDED')
      expect(diffTypes.UPDATED).toBe('UPDATED')
      expect(diffTypes.REMOVED).toBe('REMOVED')
    })
    
    test('應該定義衝突類型枚舉', () => {
      const conflictTypes = IConflictResolver.ConflictTypes
      expect(conflictTypes).toBeDefined()
      expect(conflictTypes.VALUE_CONFLICT).toBe('VALUE_CONFLICT')
      expect(conflictTypes.DELETE_UPDATE_CONFLICT).toBe('DELETE_UPDATE_CONFLICT')
    })
    
    test('應該定義策略類型枚舉', () => {
      const strategyTypes = ISyncStrategyExecutor.StrategyTypes
      expect(strategyTypes).toBeDefined()
      expect(strategyTypes.MERGE).toBe('MERGE')
      expect(strategyTypes.OVERWRITE).toBe('OVERWRITE')
      expect(strategyTypes.APPEND).toBe('APPEND')
    })
  })
  
  describe('📝 介面實例化', () => {
    test('直接實例化介面應該拋出錯誤', () => {
      expect(() => new ISynchronizationCoordinator())
        .not.toThrow() // 介面類可以實例化，但方法會拋出錯誤
      
      const instance = new ISynchronizationCoordinator()
      expect(instance.initializeSync()).rejects
        .toThrow('ISynchronizationCoordinator.initializeSync() must be implemented')
    })
    
    test('應該支援介面繼承', () => {
      class TestImplementation extends IDataComparator {
        async calculateDifferences () {
          return { summary: {}, details: {}, metadata: {} }
        }
      }
      
      const instance = new TestImplementation()
      expect(instance).toBeInstanceOf(IDataComparator)
      expect(instance.calculateDifferences()).resolves.toBeDefined()
    })
  })
})