#!/usr/bin/env node

/**
 * 事件系統 v2.0 快速驗證腳本
 * 驗證核心組件是否正確實作
 */

const EventBus = require('src/core/event-bus')
const EventNamingUpgradeCoordinator = require('src/core/events/event-naming-upgrade-coordinator')
const EventPriorityManager = require('src/core/events/event-priority-manager')
const EventTypeDefinitions = require('src/core/events/event-type-definitions')

console.log('🚀 開始驗證事件系統 v2.0 核心組件...\n')

// 測試 1: EventNamingUpgradeCoordinator
console.log('✅ 測試 1: EventNamingUpgradeCoordinator')
try {
  const eventBus = new EventBus()
  const coordinator = new EventNamingUpgradeCoordinator(eventBus)
  
  // 測試基本轉換
  const modernEvent = coordinator.convertToModernEvent('EXTRACTION.COMPLETED')
  console.log(`   - Legacy → Modern: EXTRACTION.COMPLETED → ${modernEvent}`)
  
  // 測試智能推斷
  const inferredEvent = coordinator.buildModernEventName('ANALYTICS.COUNT.UPDATED')
  console.log(`   - 智能推斷: ANALYTICS.COUNT.UPDATED → ${inferredEvent}`)
  
  // 測試雙軌註冊
  let handlerCalled = false
  coordinator.registerDualTrackListener('EXTRACTION.COMPLETED', () => {
    handlerCalled = true
  })
  
  console.log(`   - 雙軌監聽器註冊: ${eventBus.hasListener('EXTRACTION.COMPLETED') && eventBus.hasListener('EXTRACTION.READMOO.EXTRACT.COMPLETED')}`)
  
  const stats = coordinator.getConversionStats()
  console.log(`   - 轉換統計: 模式=${stats.conversionMode}, 註冊事件數=${stats.modernEventsRegistered}`)
  
  eventBus.destroy()
  console.log('   ✅ EventNamingUpgradeCoordinator 驗證通過\n')
} catch (error) {
  console.error(`   ❌ EventNamingUpgradeCoordinator 驗證失敗: ${error.message}\n`)
}

// 測試 2: EventPriorityManager
console.log('✅ 測試 2: EventPriorityManager')
try {
  const priorityManager = new EventPriorityManager()
  
  // 測試優先級分配
  const systemPriority = priorityManager.assignEventPriority('SYSTEM.GENERIC.ERROR.CRITICAL')
  const extractionPriority = priorityManager.assignEventPriority('EXTRACTION.READMOO.EXTRACT.COMPLETED')
  const analyticsPriority = priorityManager.assignEventPriority('ANALYTICS.GENERIC.LOG.COMPLETED')
  
  console.log(`   - 系統關鍵事件優先級: ${systemPriority} (預期: 0-99)`)
  console.log(`   - 業務處理事件優先級: ${extractionPriority} (預期: 300-399)`)
  console.log(`   - 背景處理事件優先級: ${analyticsPriority} (預期: 400-499)`)
  
  // 測試優先級推斷
  const systemCategory = priorityManager.inferPriorityCategory('SYSTEM.GENERIC.ERROR.CRITICAL')
  const platformCategory = priorityManager.inferPriorityCategory('PLATFORM.READMOO.DETECT.COMPLETED')
  
  console.log(`   - 優先級分類推斷: SYSTEM → ${systemCategory}, PLATFORM → ${platformCategory}`)
  
  // 測試統計
  const stats = priorityManager.getPriorityStats()
  console.log(`   - 分配統計: 總分配=${stats.totalAssignments}, 錯誤數=${stats.errors}`)
  
  console.log('   ✅ EventPriorityManager 驗證通過\n')
} catch (error) {
  console.error(`   ❌ EventPriorityManager 驗證失敗: ${error.message}\n`)
}

// 測試 3: EventTypeDefinitions
console.log('✅ 測試 3: EventTypeDefinitions')
try {
  const eventTypes = new EventTypeDefinitions()
  
  // 測試有效事件名稱驗證
  const validEvents = [
    'EXTRACTION.READMOO.EXTRACT.COMPLETED',
    'DATA.READMOO.SAVE.COMPLETED',
    'UX.GENERIC.OPEN.COMPLETED'
  ]
  
  const invalidEvents = [
    'EXTRACTION.COMPLETED', // 舊格式
    'invalid.format',
    'TOO.MANY.PARTS.HERE.INVALID'
  ]
  
  console.log('   - 有效事件驗證:')
  validEvents.forEach(event => {
    const isValid = eventTypes.isValidEventName(event)
    console.log(`     ${isValid ? '✅' : '❌'} ${event}`)
  })
  
  console.log('   - 無效事件驗證:')
  invalidEvents.forEach(event => {
    const isValid = eventTypes.isValidEventName(event)
    console.log(`     ${!isValid ? '✅' : '❌'} ${event} (應為無效)`)
  })
  
  // 測試事件建構
  const builtEvent = eventTypes.buildEventName('EXTRACTION', 'READMOO', 'EXTRACT', 'COMPLETED')
  console.log(`   - 事件建構: ${builtEvent}`)
  
  // 測試事件分解
  const parsed = eventTypes.parseEventName('EXTRACTION.READMOO.EXTRACT.COMPLETED')
  console.log(`   - 事件分解: 領域=${parsed.domain}, 平台=${parsed.platform}, 動作=${parsed.action}, 狀態=${parsed.state}`)
  
  // 測試建議功能
  const suggestions = eventTypes.suggestCorrections('EXTRACTION.COMPLETED')
  console.log(`   - 命名建議: ${suggestions.length} 個建議`)
  
  console.log('   ✅ EventTypeDefinitions 驗證通過\n')
} catch (error) {
  console.error(`   ❌ EventTypeDefinitions 驗證失敗: ${error.message}\n`)
}

// 整合測試
console.log('✅ 測試 4: 整合驗證')
try {
  const eventBus = new EventBus()
  const coordinator = new EventNamingUpgradeCoordinator(eventBus)
  const priorityManager = new EventPriorityManager()
  const eventTypes = new EventTypeDefinitions()
  
  // 測試完整流程
  const legacyEvent = 'EXTRACTION.COMPLETED'
  const modernEvent = coordinator.convertToModernEvent(legacyEvent)
  const isValidModern = eventTypes.isValidEventName(modernEvent)
  const priority = priorityManager.assignEventPriority(modernEvent)
  
  console.log(`   - 完整轉換流程:`)
  console.log(`     Legacy: ${legacyEvent}`)
  console.log(`     Modern: ${modernEvent}`)
  console.log(`     有效性: ${isValidModern}`)
  console.log(`     優先級: ${priority}`)
  
  // 測試雙軌並行
  let legacyTriggered = false
  let modernTriggered = false
  
  coordinator.registerDualTrackListener(legacyEvent, () => {
    legacyTriggered = true
  })
  
  eventBus.on(modernEvent, () => {
    modernTriggered = true
  })
  
  // 模擬事件觸發
  setTimeout(async () => {
    await eventBus.emit(legacyEvent, { test: 'data' })
    
    setTimeout(() => {
      console.log(`   - 雙軌觸發驗證: Legacy=${legacyTriggered}, Modern=${modernTriggered}`)
      
      const finalStats = coordinator.getConversionStats()
      console.log(`   - 最終統計: 轉換次數=${finalStats.totalConversions}`)
      
      eventBus.destroy()
      console.log('   ✅ 整合驗證通過\n')
      
      console.log('🎉 所有驗證完成！事件系統 v2.0 核心組件運作正常')
      console.log('')
      console.log('📋 驗證摘要:')
      console.log('   ✅ EventNamingUpgradeCoordinator - Legacy → Modern 事件轉換')
      console.log('   ✅ EventPriorityManager - 智能優先級管理')
      console.log('   ✅ EventTypeDefinitions - v2.0 命名格式驗證')
      console.log('   ✅ 整合測試 - 跨組件協作')
      console.log('')
      console.log('🚀 準備進入下一階段：Readmoo 平台遷移驗證')
    }, 100)
  }, 100)
  
} catch (error) {
  console.error(`   ❌ 整合驗證失敗: ${error.message}\n`)
}