// 快速驗證修復是否正確
const EventHandler = require('./src/core/event-handler.js')

console.log('🧪 驗證 EventHandler 修復...')

try {
    const handler = new EventHandler('test')
    console.log('✅ EventHandler 可以實例化')
    
    // 測試抽象方法
    try {
        handler.getSupportedEvents()
        console.log('❌ getSupportedEvents 應該拋出錯誤')
    } catch (error) {
        console.log('✅ getSupportedEvents 正確拋出錯誤:', error.constructor.name)
        console.log('   訊息:', error.message)
        console.log('   程式碼:', error.code)
    }
    
    // 測試異步方法
    handler.process({}).catch(error => {
        console.log('✅ process 正確拋出錯誤:', error.constructor.name)
        console.log('   訊息:', error.message)
        console.log('   程式碼:', error.code)
    })
    
} catch (error) {
    console.log('❌ 載入 EventHandler 失敗:', error.message)
}