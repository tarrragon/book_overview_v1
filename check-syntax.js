// 簡單的語法檢查腳本
console.log('檢查 NavigationService 語法...');
try {
  require('./src/background/domains/page/services/navigation-service.js');
  console.log('✅ NavigationService 語法正確');
} catch (error) {
  console.log('❌ NavigationService 語法錯誤:', error.message);
}

console.log('\n檢查 TabStateTrackingService 語法...');
try {
  require('./src/background/domains/page/services/tab-state-tracking-service.js');
  console.log('✅ TabStateTrackingService 語法正確');
} catch (error) {
  console.log('❌ TabStateTrackingService 語法錯誤:', error.message);
}