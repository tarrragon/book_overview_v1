// 簡單的語法檢查腳本
// eslint-disable-next-line no-console
console.log('檢查 NavigationService 語法...');
try {
  require('./src/background/domains/page/services/navigation-service.js');
  // eslint-disable-next-line no-console
  console.log('✅ NavigationService 語法正確');
} catch (error) {
  // eslint-disable-next-line no-console
  console.log('❌ NavigationService 語法錯誤:', error.message);
}

// eslint-disable-next-line no-console
console.log('\n檢查 TabStateTrackingService 語法...');
try {
  require('./src/background/domains/page/services/tab-state-tracking-service.js');
  // eslint-disable-next-line no-console
  console.log('✅ TabStateTrackingService 語法正確');
} catch (error) {
  // eslint-disable-next-line no-console
  console.log('❌ TabStateTrackingService 語法錯誤:', error.message);
}