#!/usr/bin/env node

/**
 * 事件統一化測試執行器
 * 用於驗證 TDD Red Phase 狀態
 */

const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('🔴 執行事件驅動統一化測試 (Red Phase)...\n');
  
  const testFile = 'tests/unit/core/event-system-unification.test.js';
  const result = execSync(`npx jest ${testFile} --verbose --colors`, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'pipe'
  });
  
  console.log(result);
  console.log('\n✅ 測試執行完成！');
  
} catch (error) {
  console.log(error.stdout || '');
  console.log(error.stderr || '');
  console.log(`\n測試退出碼: ${error.status}`);
  
  if (error.status === 0) {
    console.log('🟢 所有測試通過 - 進入 Green Phase!');
  } else {
    console.log('🔴 測試失敗 - Red Phase 確認成功');
  }
  
  process.exit(error.status);
}