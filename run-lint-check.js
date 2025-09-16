const { exec } = require('child_process');

console.log('🔍 執行 ESLint 檢查...');

exec('npx eslint src/ tests/', (error, stdout, stderr) => {
  if (error) {
    console.log('ESLint 輸出：');
    console.log(stdout);
    
    // 過濾 no-unused-vars 警告
    const lines = stdout.split('\n');
    const unusedVarsLines = lines.filter(line => line.includes('no-unused-vars'));
    
    console.log('\n📊 no-unused-vars 警告統計：');
    console.log(`總計：${unusedVarsLines.length} 個警告`);
    
    console.log('\n前 20 個 no-unused-vars 警告：');
    unusedVarsLines.slice(0, 20).forEach((line, index) => {
      console.log(`${index + 1}. ${line.trim()}`);
    });
    
    return;
  }
  
  console.log('✅ ESLint 檢查通過，沒有發現問題');
});